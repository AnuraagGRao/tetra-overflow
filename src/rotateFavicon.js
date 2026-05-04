// Rotates favicon between /icons/newicon.svg and icon1–4.svg every day of the week

const ICONS = [
  import.meta.env.BASE_URL + 'icons/newicon.svg',
  import.meta.env.BASE_URL + 'icons/icon1.svg',
  import.meta.env.BASE_URL + 'icons/icon2.svg',
  import.meta.env.BASE_URL + 'icons/icon3.svg',
  import.meta.env.BASE_URL + 'icons/icon4.svg'
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
