const { getCampaignProblem, buildCampaignRequests } = require('./campaign');

const errorMessage = (error) => (error && error.message) || String(error);

/**
 * Sends a rendered DailyMessage as a Mailchimp test email to `emails` only.
 *
 * Builds the same draft campaign as the live sender, uses Mailchimp's
 * "send test" action (which never reaches the audience), then deletes the
 * draft. It never schedules or sends the campaign. If the delete fails, the
 * draft is left in Mailchimp unsent and named in `cleanupError`.
 *
 * @param {object} options
 * @param {import('../render/dailyMessage').DailyMessage} options.message
 * @param {string[]} options.emails
 * @param {{ audienceId: string, fromName: string, replyTo: string }} options.mailchimp
 * @param {ReturnType<import('./client').createMailchimpClient>} options.client
 * @returns {Promise<{ ok: true, campaignId: string, cleanupError?: string } | { ok: false, error: string, cleanupError?: string }>}
 */
const sendTestEmail = async ({ message, emails, mailchimp, client }) => {
  if (!emails || !emails.length) {
    return { ok: false, error: 'No test email addresses given' };
  }
  const problem = getCampaignProblem(message);
  if (problem) {
    return { ok: false, error: problem };
  }

  const requests = buildCampaignRequests(message, mailchimp);
  const campaign = {
    ...requests.campaign,
    settings: { ...requests.campaign.settings, title: `TEST ${requests.campaign.settings.title}` },
  };

  let campaignId;
  let result;
  try {
    campaignId = (await client.createCampaign(campaign)).id;
    if (!campaignId) {
      return { ok: false, error: 'Mailchimp created a campaign without an id' };
    }
    await client.setContent(campaignId, requests.content);
    await client.sendTestEmail(campaignId, emails);
    result = { ok: true, campaignId };
  } catch (error) {
    result = { ok: false, error: errorMessage(error) };
  }

  if (campaignId) {
    try {
      await client.deleteCampaign(campaignId);
    } catch (error) {
      result.cleanupError = `draft campaign ${campaignId} left unsent in Mailchimp: ${errorMessage(error)}`;
    }
  }
  return result;
};

module.exports = { sendTestEmail };
