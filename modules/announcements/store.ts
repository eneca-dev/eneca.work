import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AnnouncementsState, Announcement } from '@/modules/announcements/types';

interface AnnouncementsActions {
  setAnnouncements: (announcements: Announcement[]) => void;
  addAnnouncement: (announcement: Announcement) => void;
  updateAnnouncement: (id: string, announcement: Partial<Announcement>) => void;
  deleteAnnouncement: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

type AnnouncementsStore = AnnouncementsState & AnnouncementsActions;

const initialState: AnnouncementsState = {
  announcements: [],
  isLoading: false,
  error: null,
};

export const useAnnouncementsStore = create<AnnouncementsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setAnnouncements: (announcements: Announcement[]) => 
        set({ announcements }, false, 'setAnnouncements'),

      addAnnouncement: (announcement: Announcement) => 
        set(
          (state) => ({ announcements: [...state.announcements, announcement] }),
          false,
          'addAnnouncement'
        ),

      updateAnnouncement: (id: string, announcementUpdate: Partial<Announcement>) =>
        set(
          (state) => ({
            announcements: state.announcements.map((announcement) =>
              announcement.id === id ? { ...announcement, ...announcementUpdate } : announcement
            ),
          }),
          false,
          'updateAnnouncement'
        ),

      deleteAnnouncement: (id: string) =>
        set(
          (state) => ({
            announcements: state.announcements.filter((announcement) => announcement.id !== id),
          }),
          false,
          'deleteAnnouncement'
        ),

      setLoading: (loading: boolean) => 
        set({ isLoading: loading }, false, 'setLoading'),

      setError: (error: string | null) => 
        set({ error }, false, 'setError'),

      reset: () => 
        set(initialState, false, 'reset'),
    }),
    {
      name: 'announcements-store',
    }
  )
); 