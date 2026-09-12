import { Reveal, Section, PageHero } from "../components/ui.jsx";
import { Link } from "react-router-dom";

const Block = ({ h, children }) => (
  <Reveal className="card" style={{ padding: "22px 26px", marginBottom: 16 }}>
    <h3 style={{ marginBottom: 10 }}>{h}</h3>
    {children}
  </Reveal>
);
const P = ({ children }) => <p style={{ color: "var(--muted)", fontSize: 14.5, marginBottom: 10 }}>{children}</p>;

export function Terms() {
  return (
    <>
      <PageHero crumb="Terms" title="Terms of Use" text="Plain-language terms for a paper-trading platform. Last updated: September 2026." />
      <Section>
        <div className="container" style={{ maxWidth: 860 }}>
          <Block h="1. What this service is">
            <P>Vertex Trader is a <b>paper-trading and education platform</b>. It simulates trading with virtual funds against live cryptocurrency market data provided by CoinGecko's public API. It is not a broker, exchange, bank or custodian, and it offers no financial services.</P>
          </Block>
          <Block h="2. Virtual funds only">
            <P>All balances, wallets, orders, positions and P&L on this platform are <b>virtual</b>. You cannot deposit or withdraw real money, and no real assets are ever held, transferred or traded. The Funding page moves virtual balances only.</P>
          </Block>
          <Block h="3. Accounts and acceptable use">
            <P>You must provide accurate registration details and keep your credentials secret. You are responsible for activity under your account, including enabling two-factor authentication where available. You agree not to abuse rate limits, attempt unauthorised access (including to admin areas), scrape aggressively, submit false KYC documents, or use the platform for any unlawful purpose.</P>
          </Block>
          <Block h="4. No financial advice">
            <P>Nothing on this platform — including courses, strategies, indicators, coin pages or notifications — is investment, legal or tax advice. Educational content describes mechanics and risks only. Practising here does not guarantee any outcome in real markets.</P>
          </Block>
          <Block h="5. Market data">
            <P>Prices, charts and statistics come from CoinGecko's free public API and may be delayed, rate-limited or unavailable. The platform labels cached data honestly when live feeds are limited. Data is provided "as is" without warranty.</P>
          </Block>
          <Block h="6. KYC and verification">
            <P>Identity verification is an automated, rule-based product demonstration. Its outcomes carry <b>no legal standing</b>, create no financial relationship, and are not a substitute for any regulated onboarding process.</P>
          </Block>
          <Block h="7. Suspension and termination">
            <P>We may suspend or terminate accounts that breach these terms, abuse the platform, or threaten its integrity. You may delete your account at any time from Dashboard → Settings; deletion removes your profile, tickets and emails from our storage.</P>
          </Block>
          <Block h="8. Liability">
            <P>The service is provided without warranties of any kind. To the maximum extent permitted by law, we are not liable for losses arising from use of the platform, including lost profits or data, since no real funds are involved and use is at your own risk.</P>
          </Block>
          <Block h="9. Changes & contact">
            <P>We may update these terms; continued use after changes constitutes acceptance. Questions: <Link to="/support" style={{ color: "var(--accent)" }}>open a support ticket</Link>.</P>
          </Block>
        </div>
      </Section>
    </>
  );
}

export function Privacy() {
  return (
    <>
      <PageHero crumb="Privacy" title="Privacy Policy" text="What we collect, why, where it lives, and your rights. Last updated: September 2026." />
      <Section>
        <div className="container" style={{ maxWidth: 860 }}>
          <Block h="1. Data we collect">
            <P><b>Account:</b> name, email, hashed password (scrypt + salt), currency and theme preferences, creation date. <b>Security:</b> 2FA secret (if enabled), login history (time, IP, result). <b>KYC (optional):</b> identity details and document images you submit. <b>Support:</b> ticket conversations. <b>Notifications:</b> your channel preferences and generated emails. <b>Paper wallet:</b> stored per-device in your browser for guests, per-account on the server for logged-in users.</P>
          </Block>
          <Block h="2. What we never collect">
            <P>No payment data (there are no payments), no real financial account links, no third-party advertising trackers, and no cross-site profiling. Market data you view is fetched from CoinGecko directly.</P>
          </Block>
          <Block h="3. How we use data">
            <P>To operate your account, secure it (login alerts, 2FA), run the verification and support flows you initiate, send the notifications you enable, and improve the product. We do not sell or share personal data with advertisers.</P>
          </Block>
          <Block h="4. Where data lives & emails">
            <P>Account data is stored in the platform's server database for this deployment. Emails are delivered through SMTP only when the operator configures credentials; otherwise generated emails remain queued in your outbox (visible to you in Dashboard → Notifications) and are never transmitted.</P>
          </Block>
          <Block h="5. Local storage on your device">
            <P>We use localStorage for: theme, display currency, guest paper wallets, chart caches (to respect CoinGecko rate limits) and guide progress. Clearing site data removes these, including guest wallets.</P>
          </Block>
          <Block h="6. Your rights">
            <P>You can <b>export</b> your data (Dashboard → Settings → Export my data) and <b>delete your account</b> (same page), which erases your profile, sessions, tickets and queued emails. KYC submissions can be resubmitted or removed with the account. Questions via <Link to="/support" style={{ color: "var(--accent)" }}>support</Link>.</P>
          </Block>
          <Block h="7. Retention & children">
            <P>Data is retained while your account exists and removed on deletion (support tickets tied to deleted accounts are anonymised). The service is intended for users 18+; KYC validation enforces this for verification attempts.</P>
          </Block>
          <Block h="8. Changes">
            <P>Material changes to this policy are announced via the site announcement bar or account notifications.</P>
          </Block>
        </div>
      </Section>
    </>
  );
}
