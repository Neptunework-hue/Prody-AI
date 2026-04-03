/**
 * Utility functions for consistent date handling across the app
 */

/**
 * Parses a date string that could be either ISO format or YYYY-MM-DD format
 * @param dateString - The date string to parse
 * @returns Date object
 */
export const parseDateString = (dateString: string): Date => {
  if (dateString.includes('T')) {
    // ISO string format (old format)
    return new Date(dateString);
  } else {
    // Date string format (YYYY-MM-DD, new format)
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
};

/**
 * Formats a date string to YYYY-MM-DD format for consistent storage
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format
 */
export const formatDateForStorage = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Creates a date key for calendar grouping (YYYY-MM-DD format)
 * @param date - The date to create a key for
 * @returns Date key string
 */
export const createDateKey = (date: Date): string => {
  return formatDateForStorage(date);
};

/**
 * Checks if a date is today
 * @param date - The date to check
 * @returns boolean
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

/**
 * Checks if a date is overdue
 * @param date - The date to check
 * @returns boolean
 */
export const isOverdue = (date: Date): boolean => {
  return date < new Date();
}; 