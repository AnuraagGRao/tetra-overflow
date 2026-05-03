// Rotates favicon between /icons/newicon.svg and icon1–4.svg every day of the week

const ICONS = [
  '/icons/newicon.svg',
  '/icons/icon1.svg',
  '/icons/icon2.svg',
  '/icons/icon3.svg',
  '/icons/icon4.svg'
]

export function setDailyFavicon() {
  // Base on weekday (0=Sunday, 1=Monday,...)
  const day = new Date().getDay();
  const iconPath = ICONS[day % ICONS.length]
  setFavicon(iconPath);
}

function setFavicon(href) {
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}
