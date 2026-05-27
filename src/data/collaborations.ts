import type { Collaboration } from '@/types/music';
import collabAvatar from '@/assets/859d02cc14248320a24a21e13939ed73.jpg';
import kyxAvatar from '@/assets/Kyxmi_fps-pdp.webp';

import juxAvatar from '@/assets/Jux-pdp.webp';


export const collaborations: Collaboration[] = [
  {
    id: 'jux',
    pseudo: 'Jux-154',
    display_name: 'Jux-154',
    avatar_url: juxAvatar,
    banner_url: null,
    bio: 'Créateur, Admin et Développeur de Jux-Music',
    twitch_url: null,
    youtube_url: null,
    discord_url: null,
    instagram_url: 'https://www.instagram.com/jux_1544',
    twitter_url: null,
    tiktok_url: null,
    user_id: null,
    active: true,
    sort_order: -1,
    created_at: '',
    updated_at: '',
  },
  {
    id: '1',
    pseudo: 'Kyxmi_fps',
    display_name: 'Kyxmi_fps',
    avatar_url: kyxAvatar,

    banner_url: null,
    bio: 'Créateur, Admin et Développeur de Jux-Music',
    twitch_url: 'https://www.twitch.tv/kyxmi_fps',
    youtube_url: 'https://www.youtube.com/@Kyxmi_fps',
    discord_url: 'https://discord.gg/GUDVXjGJUj',
    instagram_url: null,
    twitter_url: null,
    tiktok_url: null,
    user_id: 'b03c5f9f-1eb2-4611-9cfc-7c29df8c4438',
    active: true,
    sort_order: 0,
    created_at: '',
    updated_at: '',
  },
];
