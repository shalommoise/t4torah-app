const { renderTefillaEmail, TEFILLA_LINKS } = require('../src/services/render/tefillaEmail');

const AUDIO = 'https://episodes.castos.com/time4tefilla/877-which-good-years.mp3';
const TITLE = '877.  Which ‘Good Years’ Do We Refer To?';

describe('renderTefillaEmail', () => {
  test('uses the tidied shiur title as subject and preview text', () => {
    const email = renderTefillaEmail({ title: TITLE, audioUrl: AUDIO });
    expect(email.subject).toBe('877. Which ‘Good Years’ Do We Refer To?');
    expect(email.previewText).toBe(email.subject);
  });

  test('links the shiur title to the Castos audio, as in the manual send', () => {
    const { html, text } = renderTefillaEmail({ title: TITLE, audioUrl: AUDIO });
    expect(html).toContain(`<a href="${AUDIO}" target="_blank"`);
    expect(html).toContain('>877. Which ‘Good Years’ Do We Refer To?</a>');
    expect(text).toContain(`877. Which ‘Good Years’ Do We Refer To? (${AUDIO})`);
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });

  test('has the manual send wording and Time4Tefilla links', () => {
    const { html } = renderTefillaEmail({ title: 'x', audioUrl: AUDIO });
    [
      "Please find attached the Shiur for today's Tefilla learning.",
      'Click here to join the Time4Tefilla WhatsApp Group.',
      'questions on Davening',
      'Hatzlacha with your tefillos!',
      'Please make sure to write Time4Torah in the message',
    ].forEach((phrase) => expect(html).toContain(phrase));
    ['whatsappGroup', 'spotify', 'rss', 'email'].forEach((name) =>
      expect(html).toContain(`href="${TEFILLA_LINKS[name]}"`)
    );
    expect(html).toContain('Time4Torah-Time4Tefilla');
  });

  test('escapes the title', () => {
    const { html } = renderTefillaEmail({ title: 'Shema & <Baruch Shem>', audioUrl: AUDIO });
    expect(html).toContain('Shema &amp; &lt;Baruch Shem&gt;');
    expect(html).not.toContain('<Baruch Shem>');
  });

  test('uses the default header image unless one is given, and the optional footer image', () => {
    expect(renderTefillaEmail({ title: 'x', audioUrl: AUDIO }).html).toContain('mcusercontent.com');
    const { html } = renderTefillaEmail(
      { title: 'x', audioUrl: AUDIO },
      { headerImageUrl: 'https://cdn.example/head.png', footerImageUrl: 'https://cdn.example/foot.png' }
    );
    expect(html).toContain('src="https://cdn.example/head.png"');
    expect(html).toContain('src="https://cdn.example/foot.png"');
  });

  test('adds update-preferences and unsubscribe links when given', () => {
    const { html, text } = renderTefillaEmail(
      { title: 'x', audioUrl: AUDIO },
      { updateProfileUrl: '*|UPDATE_PROFILE|*', unsubscribeUrl: '*|UNSUB|*' }
    );
    expect(html).toContain('update your preferences</a> or <a href="*|UNSUB|*"');
    expect(text).toContain('Unsubscribe: *|UNSUB|*');
    expect(renderTefillaEmail({ title: 'x', audioUrl: AUDIO }).html).not.toContain('unsubscribe from this list');
  });

  test.each([
    ['an empty title', { title: '   ', audioUrl: AUDIO }],
    ['a missing audio link', { title: 'x', audioUrl: '' }],
    ['an http audio link', { title: 'x', audioUrl: 'http://example.com/a.mp3' }],
  ])('throws on %s', (_name, shiur) => {
    expect(() => renderTefillaEmail(shiur)).toThrow();
  });
});
