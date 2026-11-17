import { createRoot } from 'react-dom/client'
import '@fontsource/biz-udmincho/400.css'
import '@fontsource/biz-udpgothic/400.css'
import '@fontsource/biz-udpgothic/700.css'
import './check.css'
import { CheckApp } from './CheckApp'

// 提出前チェック（Word のひな形で書いている学生が、提出の前に確かめて、1つの PDF にまとめるページ）
// 古いブラウザ（public/old-browser.js が知らせを出した）では、その上に画面を作らない（依頼者の選択 2026-11-17 mockups/v136 案B）
if (!(window as Window & { sotsugyoOldBrowser?: boolean }).sotsugyoOldBrowser) createRoot(document.getElementById('root')!).render(<CheckApp />)
