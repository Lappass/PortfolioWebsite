import profileData from "../content/profile.json" with { type: "json" };

export interface Profile {
  name: string;
  alias: string;
  role: string;
  roleEn: string;
  tagline: string;
  avatar: string;
  bio: string[];
  skills: { group: string; items: string[] }[];
  experience: { time: string; title: string; detail: string }[];
  contact: { label: string; url: string }[];
  resume: string;
  boot: {
    greeting: string;
    identityLabel: string;
    identity: string;
    role: string;
    loading: string;
    ready: string;
    welcome: string;
    studio: string;
    subtitle: string;
  };
}

export const profile: Profile = profileData;
