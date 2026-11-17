const fs = require('fs');
const path = require('path');
const { renderTemplate, escapeHtml, link } = require('./emailRenderer');

// The Time4Tefilla email, matching the manual Mailchimp send. Only the shiur
// title (also the subject) and the audio link change; the audio link is the
// MP3 Castos hosts for the new episode.

const TITLE = 'Time4Tefilla';
const INTRO = "Please find attached the Shiur for today's Tefilla learning.";

// Mailchimp merge tags pre-fill the donation form, as in the manual send.
const TEFILLA_LINKS = {
  website: 'https://www.time4torah.org',
  whatsappGroup: 'https://chat.whatsapp.com/BvXBkQsfjYQGqtD11sVXRo',
  donate:
    'https://donate.jfutures.org/?message=I%20am%20supporting%20Time4Torah-Time4Tefilla' +
    '&email=*|URL:EMAIL|*&firstname=*|URL:FNAME|*&surname=*|URL:LNAME|*',
  paypal: 'https://www.paypal.com/paypalme/JewishFuturesTrust',
  email: 'mailto:tefilla@time4torah.org',
  spotify: 'https://open.spotify.com/show/1nxloDWFKxmpaNT4QhtA2t',
  rss: 'https://time4tefilla.castos.com/feed',
};

// The header image used in the manual send (hosted in Mailchimp's file manager).
const DEFAULT_HEADER_IMAGE =
  'https://mcusercontent.com/ba390245ba1e66face91e7941/images/c0539824-9263-82b4-344a-d02084467a40.png';

// Same icons and order as the manual send's follow block.
const SOCIAL_ICON_BASE = 'https://cdn-images.mailchimp.com/icons/social-block-v2';
const SOCIAL_ICONS = [
  { name: 'email', label: 'Email', icon: 'color-forwardtofriend-48.png' },
  { name: 'website', label: 'Website', icon: 'color-link-48.png' },
  { name: 'spotify', label: 'Spotify', icon: 'color-spotify-48.png' },
  { name: 'rss', label: 'RSS', icon: 'color-rss-48.png' },
];

const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', '..', 'templates', 'tefillaEmail.html'), 'utf8');

const tidy = (value) => (value == null ? '' : String(value).replace(/\s+/g, ' ').trim());

const assertHttpsUrl = (value, name) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a URL (got ${JSON.stringify(value)})`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`${name} must be an https URL (got ${JSON.stringify(value)})`);
  }
  return url.toString();
};

const renderLogoHtml = (headerImageUrl) =>
  `<a href="${escapeHtml(TEFILLA_LINKS.website)}" target="_blank">` +
  `<img src="${escapeHtml(headerImageUrl)}" width="564" alt="${TITLE}" style="display:block;width:100%;max-width:564px;height:auto;border:0;"></a>`;

const renderSocialIconsHtml = () =>
  [
    '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">',
    '<tr>' +
      SOCIAL_ICONS.map(
        ({ name, label, icon }) =>
          `<td style="padding:0 9px;"><a href="${escapeHtml(TEFILLA_LINKS[name])}" target="_blank">` +
          `<img src="${SOCIAL_ICON_BASE}/${icon}" alt="${label}" width="24" height="24" style="display:block;border:0;"></a></td>`
      ).join('') +
      '</tr>',
    '</table>',
  ].join('\n');

const FOOTER_LINK_STYLE = 'color:#656565;text-decoration:underline;';

/**
 * The Time4Tefilla email (subject, preview text, HTML and plain text), with
 * the wording and layout of the manual send.
 *
 * @param {object} shiur
 * @param {string} shiur.title The shiur title, e.g. `877. Which ‘Good Years’ Do We Refer To?`; also the subject.
 * @param {string} shiur.audioUrl The Castos-hosted MP3 for the episode.
 * @param {object} [emailConfig]
 * @param {string|null} [emailConfig.headerImageUrl] Defaults to the manual send's header image.
 * @param {string|null} [emailConfig.footerImageUrl] Optional image below the donation lines.
 * @param {string|null} [emailConfig.unsubscribeUrl] e.g. Mailchimp's `*|UNSUB|*`.
 * @param {string|null} [emailConfig.updateProfileUrl] e.g. Mailchimp's `*|UPDATE_PROFILE|*`.
 * @returns {{ subject: string, previewText: string, html: string, text: string }}
 */
const renderTefillaEmail = (
  { title, audioUrl },
  { headerImageUrl = null, footerImageUrl = null, unsubscribeUrl = null, updateProfileUrl = null } = {}
) => {
  const shiurTitle = tidy(title);
  if (!shiurTitle) {
    throw new Error('Time4Tefilla email needs a shiur title');
  }
  const audio = assertHttpsUrl(audioUrl, 'audioUrl');

  const linkValues = Object.fromEntries(
    Object.entries(TEFILLA_LINKS).map(([name, href]) => [`link_${name}`, escapeHtml(href)])
  );

  const preferenceLinks = [
    updateProfileUrl ? link(updateProfileUrl, 'update your preferences', FOOTER_LINK_STYLE) : null,
    unsubscribeUrl ? link(unsubscribeUrl, 'unsubscribe from this list', FOOTER_LINK_STYLE) : null,
  ].filter(Boolean);

  const html = renderTemplate(TEMPLATE, {
    ...linkValues,
    title: TITLE,
    previewText: escapeHtml(shiurTitle),
    logo: renderLogoHtml(headerImageUrl || DEFAULT_HEADER_IMAGE),
    shiurTitle: escapeHtml(shiurTitle),
    audioUrl: escapeHtml(audio),
    footerImage: footerImageUrl
      ? `<p style="margin:24px 0 0 0;"><img src="${escapeHtml(footerImageUrl)}" width="564" alt="" style="display:block;width:100%;max-width:564px;height:auto;border:0;"></p>`
      : '',
    socialIcons: renderSocialIconsHtml(),
    unsubscribe: preferenceLinks.length
      ? `Want to change how you receive these emails?<br>You can ${preferenceLinks.join(' or ')}`
      : '',
  });

  const text = [
    [INTRO, '', `${shiurTitle} (${audio})`].join('\n'),
    ['Want Time4Tefilla straight to your phone?', `Click here to join the Time4Tefilla WhatsApp Group. (${TEFILLA_LINKS.whatsappGroup})`].join('\n'),
    [
      "Time4Tefilla welcomes all questions on Davening or technical issues, as well as any feedback or comments, so please don't hesitate to email us at any time.",
      '',
      'Hatzlacha with your tefillos!',
      '',
      '---',
      TITLE,
      'Time4Torah',
      'www.time4torah.org',
      '',
      `Help us disseminate Torah across the world! (${TEFILLA_LINKS.donate})`,
      `Click here to donate to Time4Tefilla (${TEFILLA_LINKS.donate})`,
      `Click here to donate with Paypal (${TEFILLA_LINKS.paypal})`,
      'Please make sure to write Time4Torah in the message',
    ].join('\n'),
    preferenceLinks.length
      ? [
          'Want to change how you receive these emails?',
          ...(updateProfileUrl ? [`Update your preferences: ${updateProfileUrl}`] : []),
          ...(unsubscribeUrl ? [`Unsubscribe: ${unsubscribeUrl}`] : []),
        ].join('\n')
      : null,
  ]
    .filter(Boolean)
    .join('\n\n') + '\n';

  return { subject: shiurTitle, previewText: shiurTitle, html, text };
};

module.exports = { renderTefillaEmail, TEFILLA_LINKS };
