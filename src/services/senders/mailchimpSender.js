const fs = require('fs/promises');
const path = require('path');
const { createDailyMessage } = require('../render/dailyMessage');
const { createMailchimpClient } = require('../mailchimp/client');
const { getCampaignProblem, buildCampaignRequests, planDelivery } = require('../mailchimp/campaign');

// Mailchimp campaign statuses (GET /campaigns/{id} → status).
const GOING_OUT = ['schedule', 'sending', 'sent'];
const NOT_GOING_OUT = ['save', 'paused', 'canceled'];

const DEFAULT_OUTBOX_DIR = 'outbox';

const errorMessage = (error) => (error && error.message) || String(error);

const describeDelivery = (delivery) =>
  delivery.action === 'schedule'
    ? `scheduled for ${delivery.at.toISOString()}`
    : `sent now (late; send time was ${delivery.at.toISOString()})`;

const requireMailchimpConfig = (config) => {
  if (!config.mailchimp) {
    throw new Error('Mailchimp sender needs config.mailchimp (see src/config/mailchimp.js)');
  }
  return config.mailchimp;
};

/**
 * Live email sender: one Mailchimp campaign per message, to the whole
 * audience (Mailchimp delivers only to subscribed members).
 *
 * create campaign → set content → schedule for SEND_TIME (or send at once if
 * late that day) → read the status back. Returns the campaign id as `id`.
 *
 * Failures:
 * - before scheduling: `ok: false`; nothing went out, so a later run may retry
 *   (any draft campaign is named in the error and left in Mailchimp);
 * - schedule/send call fails: the status is read back. Scheduled or sent →
 *   ok; still a draft → `ok: false`; status unreadable or unexpected →
 *   `uncertain`, so send_log stays claimed and nothing resends automatically.
 *
 * @param {object} config
 * @param {ReturnType<import('../../config/mailchimp').getMailchimpConfig>} config.mailchimp
 * @param {{ log: (line: string) => void }} [config.logger]
 * @param {ReturnType<typeof createMailchimpClient>} [config.mailchimpClient] For tests.
 * @param {() => Date} [config.now] For tests.
 * @returns {import('./index').Sender}
 */
const createMailchimpSender = (config = {}) => {
  const mailchimp = requireMailchimpConfig(config);
  const client = config.mailchimpClient || createMailchimpClient(mailchimp);
  const now = config.now || (() => new Date());
  const logger = config.logger || console;

  const log = (message, text) => logger.log(`[live] mailchimp ${message.program} ${message.date}: ${text}`);

  const outcome = (message, campaignId, delivery, campaign) => {
    const recipients = campaign.recipients ? campaign.recipients.recipient_count : undefined;
    log(
      message,
      `campaign ${campaignId} ${describeDelivery(delivery)} (status ${campaign.status}` +
        `${recipients !== undefined ? `, ${recipients} recipients` : ''})`
    );
    return { ok: true, id: campaignId };
  };

  /** After the schedule/send call succeeded: confirm the status. */
  const verify = async (message, campaignId, delivery) => {
    let campaign;
    try {
      campaign = await client.getCampaign(campaignId);
    } catch (error) {
      // The schedule/send call itself succeeded, so treat it as sent.
      log(message, `campaign ${campaignId} ${describeDelivery(delivery)}; status not verified: ${errorMessage(error)}`);
      return { ok: true, id: campaignId };
    }
    if (GOING_OUT.includes(campaign.status)) {
      return outcome(message, campaignId, delivery, campaign);
    }
    if (NOT_GOING_OUT.includes(campaign.status)) {
      return { ok: false, error: `Campaign ${campaignId} has status ${campaign.status} after ${delivery.action}` };
    }
    return {
      ok: false,
      uncertain: true,
      error: `Campaign ${campaignId} has unexpected status ${campaign.status} after ${delivery.action}`,
    };
  };

  /** After the schedule/send call failed: was it accepted anyway? */
  const resolveAfterError = async (message, campaignId, delivery, actionError) => {
    const failure = `${errorMessage(actionError)} (campaign ${campaignId})`;
    let campaign;
    try {
      campaign = await client.getCampaign(campaignId);
    } catch (error) {
      return { ok: false, uncertain: true, error: `${failure}; status check failed: ${errorMessage(error)}` };
    }
    if (GOING_OUT.includes(campaign.status)) {
      log(message, `${delivery.action} reported an error but Mailchimp has it: ${errorMessage(actionError)}`);
      return outcome(message, campaignId, delivery, campaign);
    }
    if (NOT_GOING_OUT.includes(campaign.status)) {
      return { ok: false, error: `${failure}; campaign status is ${campaign.status}, nothing sent` };
    }
    return { ok: false, uncertain: true, error: `${failure}; campaign status is ${campaign.status}` };
  };

  return {
    name: 'mailchimp-email',
    channel: 'email',
    send: async (rawMessage) => {
      let message;
      let delivery;
      try {
        message = createDailyMessage(rawMessage);
        const problem = getCampaignProblem(message);
        if (problem) {
          return { ok: false, error: problem };
        }
        delivery = planDelivery({
          date: message.date,
          now: now(),
          sendTime: mailchimp.sendTime,
          sendTimeZone: mailchimp.sendTimeZone,
        });
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }

      const requests = buildCampaignRequests(message, mailchimp);
      let campaignId;
      try {
        campaignId = (await client.createCampaign(requests.campaign)).id;
        if (!campaignId) {
          return { ok: false, error: 'Mailchimp created a campaign without an id' };
        }
        await client.setContent(campaignId, requests.content);
      } catch (error) {
        const draft = campaignId ? ` (draft campaign ${campaignId} left unsent)` : '';
        return { ok: false, error: `${errorMessage(error)}${draft}` };
      }

      try {
        if (delivery.action === 'schedule') {
          await client.scheduleCampaign(campaignId, delivery.at);
        } else {
          await client.sendCampaign(campaignId);
        }
      } catch (error) {
        return resolveAfterError(message, campaignId, delivery, error);
      }
      return verify(message, campaignId, delivery);
    },
  };
};

/**
 * Dry-run sender: builds the same Mailchimp requests as the live sender and
 * writes them to `<outboxDir>/<date>/email-<program>.mailchimp.json`. Never
 * calls Mailchimp; the API key is not written. A date whose send time has
 * passed is noted in the file (so past dates can still be previewed).
 *
 * @param {object} config
 * @param {ReturnType<import('../../config/mailchimp').getMailchimpConfig>} config.mailchimp
 * @param {string} [config.outboxDir]
 * @param {() => Date} [config.now] For tests.
 * @returns {import('./index').Sender}
 */
const createMailchimpPreviewSender = (config = {}) => {
  const mailchimp = requireMailchimpConfig(config);
  const outboxDir = path.resolve(process.cwd(), config.outboxDir || DEFAULT_OUTBOX_DIR);
  const now = config.now || (() => new Date());

  return {
    name: 'mailchimp-preview',
    channel: 'email',
    send: async (rawMessage) => {
      try {
        const message = createDailyMessage(rawMessage);
        const problem = getCampaignProblem(message);
        if (problem) {
          return { ok: false, error: problem };
        }

        let delivery;
        try {
          delivery = planDelivery({
            date: message.date,
            now: now(),
            sendTime: mailchimp.sendTime,
            sendTimeZone: mailchimp.sendTimeZone,
          });
        } catch (error) {
          delivery = { action: 'none', error: errorMessage(error) };
        }

        const requests = buildCampaignRequests(message, mailchimp);
        const action =
          delivery.action === 'schedule'
            ? { method: 'POST', path: '/campaigns/{id}/actions/schedule', body: { schedule_time: delivery.at.toISOString() } }
            : { method: 'POST', path: '/campaigns/{id}/actions/send' };
        const preview = {
          server: `https://${mailchimp.serverPrefix}.api.mailchimp.com/3.0`,
          delivery,
          requests: [
            { method: 'POST', path: '/campaigns', body: requests.campaign },
            { method: 'PUT', path: '/campaigns/{id}/content', body: requests.content },
            ...(delivery.action === 'none' ? [] : [action]),
            { method: 'GET', path: '/campaigns/{id}' },
          ],
        };

        const dayDir = path.join(outboxDir, message.date);
        await fs.mkdir(dayDir, { recursive: true });
        const filePath = path.join(dayDir, `email-${message.program}.mailchimp.json`);
        await fs.writeFile(filePath, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');
        return { ok: true, id: filePath };
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }
    },
  };
};

module.exports = { createMailchimpSender, createMailchimpPreviewSender, GOING_OUT, NOT_GOING_OUT };
