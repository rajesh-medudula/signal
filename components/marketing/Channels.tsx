const channels = [
  "Gmail",
  "WhatsApp Business",
  "Instagram",
  "Telegram",
  "Facebook Messenger",
  "Website chat",
];

export function Channels() {
  return (
    <section id="channels" className="border-t border-rule">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="max-w-md font-display text-3xl text-ink">
          Built for the channels you already use
        </h2>
        <p className="mt-4 max-w-md text-ink-soft">
          Connect the ones your customers write to you on. Signal understands
          English, Hindi, Telugu, Tamil, and the mixed-language messages in
          between.
        </p>

        <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-4 text-ink-soft">
          {channels.map((channel) => (
            <li key={channel} className="border-b border-transparent">
              {channel}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
