import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { CalendarState, CalendarEvent, WorkSchedule } from '@/modules/calendar/types';

interface CalendarActions {
  setCurrentDate: (date: Date) => void;
  setView: (view: 'month' | 'week' | 'day') => void;
  setSelectedDate: (date: Date | null) => void;
  setEvents: (events: CalendarEvent[]) => void;
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  setWorkSchedules: (schedules: WorkSchedule[]) => void;
  addWorkSchedule: (schedule: WorkSchedule) => void;
  updateWorkSchedule: (id: string, schedule: Partial<WorkSchedule>) => void;
  deleteWorkSchedule: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

type CalendarStore = CalendarState & CalendarActions;

const initialState: CalendarState = {
  currentDate: new Date(),
  view: 'month',
  selectedDate: null,
  events: [],
  workSchedules: [],
  isLoading: false,
  error: null,
};

export const useCalendarStore = create<CalendarStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setCurrentDate: (date: Date) => 
        set({ currentDate: date }, false, 'setCurrentDate'),

      setView: (view: 'month' | 'week' | 'day') => 
        set({ view }, false, 'setView'),

      setSelectedDate: (date: Date | null) => 
        set({ selectedDate: date }, false, 'setSelectedDate'),

      setEvents: (events: CalendarEvent[]) => 
        set({ events }, false, 'setEvents'),

      addEvent: (event: CalendarEvent) => 
        set(
          (state) => ({ events: [...state.events, event] }),
          false,
          'addEvent'
        ),

      updateEvent: (id: string, eventUpdate: Partial<CalendarEvent>) =>
        set(
          (state) => ({
            events: state.events.map((event) =>
              event.calendar_event_id === id ? { ...event, ...eventUpdate } : event
            ),
          }),
          false,
          'updateEvent'
        ),

      deleteEvent: (id: string) =>
        set(
          (state) => ({
            events: state.events.filter((event) => event.calendar_event_id !== id),
          }),
          false,
          'deleteEvent'
        ),

      setWorkSchedules: (schedules: WorkSchedule[]) => 
        set({ workSchedules: schedules }, false, 'setWorkSchedules'),

      addWorkSchedule: (schedule: WorkSchedule) =>
        set(
          (state) => ({ workSchedules: [...state.workSchedules, schedule] }),
          false,
          'addWorkSchedule'
        ),

      updateWorkSchedule: (id: string, scheduleUpdate: Partial<WorkSchedule>) =>
        set(
          (state) => ({
            workSchedules: state.workSchedules.map((schedule) =>
              schedule.id === id ? { ...schedule, ...scheduleUpdate } : schedule
            ),
          }),
          false,
          'updateWorkSchedule'
        ),

      deleteWorkSchedule: (id: string) =>
        set(
          (state) => ({
            workSchedules: state.workSchedules.filter((schedule) => schedule.id !== id),
          }),
          false,
          'deleteWorkSchedule'
        ),

      setLoading: (loading: boolean) => 
        set({ isLoading: loading }, false, 'setLoading'),

      setError: (error: string | null) => 
        set({ error }, false, 'setError'),

      reset: () => 
        set(initialState, false, 'reset'),
    }),
    {
      name: 'calendar-store',
    }
  )
); 