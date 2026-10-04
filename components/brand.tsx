import styles from "./brand.module.css";
// Home remains reachable even if a client-side route transition stalls.
// eslint-disable-next-line @next/next/no-html-link-for-pages -- This home escape deliberately uses document navigation.
export function Brand(){return <a className="brand" href="/" aria-label="Riparim Startseite"><img className={styles.logo} src="/riparim-logo-display.png" width={512} height={195} alt="riparim"/></a>;}
