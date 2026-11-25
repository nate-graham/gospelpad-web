import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Put page metadata (Open Graph tags) in <head> for every visitor, not just
  // known bots, so link previews work in WhatsApp, Telegram, Signal and others.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
