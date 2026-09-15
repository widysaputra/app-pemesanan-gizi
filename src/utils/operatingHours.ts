/**
 * Utility for Hospital Nutrition Order Operating Hours
 * Jam Buka Pemesanan: 07:00 WIB - 19:00 WIB
 */

export interface OperatingHoursInfo {
  isOpen: boolean;
  openTimeStr: string;
  closeTimeStr: string;
  currentTimeFormatted: string;
  statusBadge: {
    label: string;
    bg: string;
    text: string;
    dot: string;
  };
  message: string;
  minutesUntilOpen?: number;
  minutesUntilClose?: number;
}

export const ORDER_OPEN_TIME = '07:00';
export const ORDER_CLOSE_TIME = '19:00';

/**
 * Returns current Date object converted to Asia/Jakarta (WIB) timezone
 */
export function getJakartaDate(customDate?: Date): Date {
  const base = customDate || new Date();
  try {
    const jakartaString = base.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    return new Date(jakartaString);
  } catch {
    // Fallback: if browser doesn't support timeZone Intl, calculate UTC+7
    const utcTime = base.getTime() + (base.getTimezoneOffset() * 60000);
    const wibOffset = 7 * 60 * 60000;
    return new Date(utcTime + wibOffset);
  }
}

/**
 * Check if the order service is currently open (07:00 - 19:00 WIB)
 */
export function checkOrderOperatingHours(customDate?: Date): OperatingHoursInfo {
  const jakartaDate = getJakartaDate(customDate);
  const hours = jakartaDate.getHours();
  const minutes = jakartaDate.getMinutes();
  const currentTotalMinutes = hours * 60 + minutes;

  // 07:00 -> 7 * 60 = 420
  const openTotalMinutes = 7 * 60;
  // 19:00 -> 19 * 60 = 1140
  const closeTotalMinutes = 19 * 60;

  const isOpen = currentTotalMinutes >= openTotalMinutes && currentTotalMinutes < closeTotalMinutes;

  const currentFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} WIB`;

  if (isOpen) {
    const minutesLeft = closeTotalMinutes - currentTotalMinutes;
    const hoursLeft = Math.floor(minutesLeft / 60);
    const minsLeft = minutesLeft % 60;
    const remainingText = hoursLeft > 0 ? `${hoursLeft} jam ${minsLeft} mnt lagi` : `${minsLeft} menit lagi`;

    return {
      isOpen: true,
      openTimeStr: ORDER_OPEN_TIME,
      closeTimeStr: ORDER_CLOSE_TIME,
      currentTimeFormatted: currentFormatted,
      minutesUntilClose: minutesLeft,
      statusBadge: {
        label: `Buka (${ORDER_OPEN_TIME} - ${ORDER_CLOSE_TIME} WIB)`,
        bg: 'bg-emerald-50 border-emerald-300 text-emerald-800',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
      },
      message: `Layanan pemesanan makanan dibuka hingga pukul ${ORDER_CLOSE_TIME} WIB (sisa waktu: ${remainingText}).`,
    };
  } else {
    let minutesUntilOpen = 0;
    if (currentTotalMinutes < openTotalMinutes) {
      // Before 07:00 morning
      minutesUntilOpen = openTotalMinutes - currentTotalMinutes;
    } else {
      // After 19:00 night (until tomorrow 07:00)
      minutesUntilOpen = (24 * 60 - currentTotalMinutes) + openTotalMinutes;
    }

    const hoursToOpen = Math.floor(minutesUntilOpen / 60);
    const minsToOpen = minutesUntilOpen % 60;
    const countdownText = hoursToOpen > 0 ? `${hoursToOpen} jam ${minsToOpen} menit` : `${minsToOpen} menit`;

    return {
      isOpen: false,
      openTimeStr: ORDER_OPEN_TIME,
      closeTimeStr: ORDER_CLOSE_TIME,
      currentTimeFormatted: currentFormatted,
      minutesUntilOpen,
      statusBadge: {
        label: `Tutup (Buka ${ORDER_OPEN_TIME} WIB)`,
        bg: 'bg-rose-50 border-rose-300 text-rose-800',
        text: 'text-rose-700',
        dot: 'bg-rose-500',
      },
      message: currentTotalMinutes < openTotalMinutes
        ? `Layanan pemesanan belum dibuka. Jam buka operasional: ${ORDER_OPEN_TIME} s/d ${ORDER_CLOSE_TIME} WIB (buka kembali dalam ${countdownText}).`
        : `Layanan pemesanan telah ditutup (tutup pukul ${ORDER_CLOSE_TIME} WIB). Pemesanan dibuka kembali besok pagi pukul ${ORDER_OPEN_TIME} WIB.`,
    };
  }
}
