// Creates, fills, schedules (or sends) and verifies one Mailchimp campaign.
// Shared by the daily live sender (../senders/mailchimpSender.js) and the
// Time4Tefilla pipeline, so both treat failures the same way.

// Mailchimp campaign statuses (GET /campaigns/{id} → status).
const GOING_OUT = ['schedule', 'sending', 'sent'];
const NOT_GOING_OUT = ['save', 'paused', 'canceled'];

const errorMessage = (error) => (error && error.message) || String(error);

/**
 * @param {{ action: 'schedule'|'send', at: Date }} delivery
 * @returns {string}
 */
const describeDelivery = (delivery) =>
  delivery.action === 'schedule'
    ? `scheduled for ${delivery.at.toISOString()}`
    : `sent now (late; send time was ${delivery.at.toISOString()})`;

/**
 * create campaign → set content → schedule for `delivery.at` (or send at once)
 * → read the status back.
 *
 * Failures:
 * - before scheduling: `ok: false`; nothing went out, so a later run may retry
 *   (any draft campaign is named in the error and left in Mailchimp);
 * - schedule/send call fails: the status is read back. Scheduled or sent →
 *   ok; still a draft → `ok: false`; status unreadable or unexpected →
 *   `uncertain`, so the caller must not resend automatically.
 *
 * @param {object} options
 * @param {ReturnType<import('./client').createMailchimpClient>} options.client
 * @param {{ campaign: object, content: object }} options.requests buildCampaignRequests output
 * @param {{ action: 'schedule'|'send', at: Date }} options.delivery planDelivery output
 * @param {(text: string) => void} [options.log]
 * @returns {Promise<{ ok: true, id: string } | { ok: false, error: string, uncertain?: true }>}
 */
const deliverCampaign = async ({ client, requests, delivery, log = () => {} }) => {
  const outcome = (campaignId, campaign) => {
    const recipients = campaign.recipients ? campaign.recipients.recipient_count : undefined;
    log(
      `campaign ${campaignId} ${describeDelivery(delivery)} (status ${campaign.status}` +
        `${recipients !== undefined ? `, ${recipients} recipients` : ''})`
    );
    return { ok: true, id: campaignId };
  };

  /** After the schedule/send call succeeded: confirm the status. */
  const verify = async (campaignId) => {
    let campaign;
    try {
      campaign = await client.getCampaign(campaignId);
    } catch (error) {
      // The schedule/send call itself succeeded, so treat it as sent.
      log(`campaign ${campaignId} ${describeDelivery(delivery)}; status not verified: ${errorMessage(error)}`);
      return { ok: true, id: campaignId };
    }
    if (GOING_OUT.includes(campaign.status)) {
      return outcome(campaignId, campaign);
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
  const resolveAfterError = async (campaignId, actionError) => {
    const failure = `${errorMessage(actionError)} (campaign ${campaignId})`;
    let campaign;
    try {
      campaign = await client.getCampaign(campaignId);
    } catch (error) {
      return { ok: false, uncertain: true, error: `${failure}; status check failed: ${errorMessage(error)}` };
    }
    if (GOING_OUT.includes(campaign.status)) {
      log(`${delivery.action} reported an error but Mailchimp has it: ${errorMessage(actionError)}`);
      return outcome(campaignId, campaign);
    }
    if (NOT_GOING_OUT.includes(campaign.status)) {
      return { ok: false, error: `${failure}; campaign status is ${campaign.status}, nothing sent` };
    }
    return { ok: false, uncertain: true, error: `${failure}; campaign status is ${campaign.status}` };
  };

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
    return resolveAfterError(campaignId, error);
  }
  return verify(campaignId);
};

module.exports = { GOING_OUT, NOT_GOING_OUT, describeDelivery, deliverCampaign };
