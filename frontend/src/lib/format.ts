import { format, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr });
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'EEEE d MMMM yyyy', { locale: fr });
}

export function formatTime(iso: string): string {
  return format(parseISO(iso), "HH'h'mm", { locale: fr });
}

export function formatDayKey(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd');
}

export function sameDay(a: string, b: string): boolean {
  return isSameDay(parseISO(a), parseISO(b));
}

export function weekdayLabel(weekday: number): string {
  return ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][weekday] ?? '';
}

export function minutesToHHMM(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}
