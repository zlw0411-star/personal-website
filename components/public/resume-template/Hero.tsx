/**
 * Adapted from the MIT-licensed React Resume Template.
 * Source: src/components/Sections/Hero.tsx
 * Upstream: 49ce16c0dd1b382edc1ec2cef6120345776d19b9
 * Full license: vendor/react-resume-template/LICENSE
 */
import { DEFAULT_PROFILE, type Profile } from "@/lib/content-types";
import Section from "./Section";

export default function Hero({ profile }: { profile: Profile }) {
  const hasBio = profile.bio.trim() && profile.bio.trim() !== DEFAULT_PROFILE.bio.trim();
  const hasNickname = profile.nickname.trim() && profile.nickname.trim() !== DEFAULT_PROFILE.nickname;
  const hasSiteName = profile.siteName.trim();
  return <Section noPadding sectionId="hero" className="rr-hero-section" labelledBy="rr-hero-title">
    <div className={`rr-hero-stage${profile.avatarId ? " rr-hero-has-avatar" : " rr-hero-no-avatar"}`}>
      <div className="rr-hero-copy">
        {hasSiteName && <p className="rr-hero-eyebrow">{profile.siteName}</p>}
        <p className="rr-hero-greeting">你好，欢迎来到我的个人主页</p>
        <h1 id="rr-hero-title" className="rr-hero-title">
          {hasNickname ? <>我是 <span className="rr-hero-name">{profile.nickname}</span></> : "个人主页"}
        </h1>
        {hasBio && <p className="rr-hero-bio">{profile.bio}</p>}
      </div>
      {profile.avatarId && <figure className="rr-hero-photo">
        <img
          alt={`${profile.nickname === DEFAULT_PROFILE.nickname ? "个人" : profile.nickname}头像`}
          src={`/api/media/${encodeURIComponent(profile.avatarId)}`}
          width={295}
          height={413}
        />
      </figure>}
    </div>
  </Section>;
}
