import Link from "next/link";
import styles from "./brand.module.css";
export function Brand(){return <Link className="brand" href="/" aria-label="Riparim Startseite"><img className={styles.logo} src="/riparim-logo-display.png" width={512} height={195} alt="riparim"/></Link>;}
