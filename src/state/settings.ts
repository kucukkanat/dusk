import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SwipeAction = "reply" | "like" | "repost" | "zap" | "bookmark" | "mute";
export type FeedSource = "following" | "fof" | "global" | "tag" | "long" | "relay" | "set" | "pictures" | "video";
export type Feed = { id: string; name: string; src: FeedSource; tag?: string; relay?: string; set?: string };

export type Settings = {
  theme: "auto" | "night" | "dawn";
  accent: "mist" | "peach" | "rose" | "sage" | "lilac" | "butter";
  density: "comfortable" | "compact";
  textSize: "normal" | "large";
  contrast: "normal" | "more";
  reduceMotion: boolean;
  dataSaver: boolean;
  altReminder: boolean;
  hideCounts: boolean;
  swipeStart: SwipeAction;
  swipeEnd: SwipeAction;
  advanced: boolean;
  wot: boolean;
  blurMedia: "never" | "strangers" | "always";
  notif: { mentions: boolean; dms: boolean; zaps: boolean; likes: boolean; follows: boolean; quiet: boolean };
  defaultZap: number;
  oneTapZap: boolean;
  zapComment: string;
  mediaServer: string;
  feeds: Feed[];
  activeFeed: string;
  onboarded: boolean;
};

const DEFAULTS: Settings = {
  theme: "auto",
  accent: "mist",
  density: "comfortable",
  textSize: "normal",
  contrast: "normal",
  reduceMotion: false,
  dataSaver: false,
  altReminder: true,
  hideCounts: false,
  swipeStart: "reply",
  swipeEnd: "like",
  advanced: false,
  wot: true,
  blurMedia: "strangers",
  notif: { mentions: true, dms: true, zaps: true, likes: false, follows: true, quiet: true },
  defaultZap: 21,
  oneTapZap: false,
  zapComment: "",
  mediaServer: "https://blossom.primal.net",
  feeds: [
    { id: "following", name: "Following", src: "following" },
    { id: "fof", name: "Friends of friends", src: "fof" },
    { id: "global", name: "Global", src: "global" },
    { id: "pictures", name: "Pictures", src: "pictures" },
    { id: "long", name: "Long reads", src: "long" },
  ],
  activeFeed: "following",
  onboarded: false,
};

type SettingsStore = Settings & {
  set: (patch: Partial<Settings>) => void;
  setNotif: (patch: Partial<Settings["notif"]>) => void;
  reset: () => void;
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      setNotif: (patch) => set((s) => ({ notif: { ...s.notif, ...patch } })),
      reset: () => set(DEFAULTS),
    }),
    {
      name: "dusk.settings",
      version: 2,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        return { ...current, ...p, notif: { ...current.notif, ...(p.notif ?? {}) } };
      },
    },
  ),
);

export const getSettings = () => useSettings.getState();
