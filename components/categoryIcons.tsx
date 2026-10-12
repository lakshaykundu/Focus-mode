import { Clapperboard, Globe, Music2, Users, type LucideIcon } from 'lucide-react';
import type { SiteCategory } from '@/types/settings';

export const CATEGORY_ICONS: Record<SiteCategory, LucideIcon> = {
  social: Users,
  entertainment: Clapperboard,
  music: Music2,
  custom: Globe,
};
