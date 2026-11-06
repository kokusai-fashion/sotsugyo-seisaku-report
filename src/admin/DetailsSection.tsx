import { useEffect, useState, type ReactNode } from 'react'
import type { PageMargins, YearConfig } from '../config'
import { DEFAULT_MARGINS } from '../layout/pageGeometry'
import { chapterTitles, DEFAULT_TEMPLATE, standardTemplate } from '../model/template'
import { AdminIcon } from './adminIcons'
import { courseName } from './changes'
import { server, type PdfFolder } from './server'
import { NumberInput, OptionalNumberInput, Row, SectionHead, TextInput } from './ui'

/**
 * 「詳細設定」の区切り（ふだんは変えない項目。mockups/v43 案A の詳細設定の分け方を、案B の区切りに入れたもの）。
 * Google の障害のとき・表紙と抄録の言葉・ページの余白・分量の決まり・学籍番号に分けて、1列に並べる
 */
/** ページの余白の説明（依頼者の判断 2026-10-27：mockups/v69 案A。左右は同じ・38字×38行のまま） */
const MARGINS_HINT = '1ページ38字×38行のまま、字の間と行の間で合わせます。表紙と作品写真のページは変わりません'
/** 学籍番号の形式の説明（何に使うか・空のときどうなるか。依頼者から「この欄は何か」と聞かれた 2026-10-22） */
const STUDENT_ID_HINT = '学籍番号の形の決まりです。学生がログインした大学のアカウント（wu22fa0001@… など）から学籍番号を読み取るとき（学生か先生かの見分けにも使います）と、表紙に打った学籍番号を確かめるときに使います。空なら、ツールに入っている形（数字2桁・英字2〜3字・数字3〜4桁）で読み取り、表紙の学籍番号は確かめません。'

/**
 * PDF の控えのもとのフォルダ（どの年度にも共通。依頼者の選択 2026-11-05 mockups/v112 案A）。
 * この中に、年度のフォルダ、その中にコースのフォルダが自動でできる（控えと点検表）。フォルダを変えると、これから届く控えと作る点検表が新しいフォルダに入る。
 * 年度の設定ではないので、「保存して学生に反映」ではなく、この欄の「このフォルダにする」ですぐ変わる
 */
function PdfFolderCard() {
  const [folder, setFolder] = useState<PdfFolder | null>(null)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => {
    let alive = true
    server.getPdfFolder().then(
      (f) => alive && setFolder(f),
      (e: Error) => alive && setMessage({ ok: false, text: e.message }),
    )
    return () => {
      alive = false
    }
  }, [])
  const apply = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const f = await server.setPdfFolder(link)
      setFolder(f)
      setLink('')
      setMessage({ ok: true, text: `「${f.name ?? f.id}」にしました。これから届く控えと、これから作る点検表は、このフォルダに入ります` })
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  const year = new Date().getFullYear()
  return (
    <div className="card pdf-folder">
      <h2 className="card-h">
        <span className="set-ic t-sheet">{AdminIcon.folder}</span>
        PDF の控えのフォルダ<small>どの年度にも共通</small>
      </h2>
      <div className="grid">
        <Row label="今のフォルダ" hint="学生が書き出した PDF の控えと、コースの点検表が入ります。見られるのは、このフォルダを共有している人だけです。">
          {folder ? (
            <span className="pf-now">
              <b>{folder.name ?? '（名前を読めません）'}</b>
              {folder.url && (
                <a href={folder.url} target="_blank" rel="noreferrer">
                  ドライブで開く ↗
                </a>
              )}
              {folder.error && <span className="pf-error">{folder.error}</span>}
            </span>
          ) : (
            <span className="pf-now">読み込んでいます…</span>
          )}
        </Row>
        <Row label="中のつくり" sub="自動でできます">
          <div className="pf-tree">
            <div>📁 {folder?.name ?? 'PDF の控えのフォルダ'}</div>
            <div className="d1">└ 📁 {year}年度</div>
            <div className="d2">└ 📁 コースごと（控え・点検表）</div>
          </div>
        </Row>
        <Row
          label="フォルダを変える"
          htmlFor="d-pdfFolder"
          hint={
            <>
              変えると、これから届く控えと、これから作る点検表が、新しいフォルダに入ります。今までのものは、元のフォルダに残ります。
              <br />
              このツールを設置したアカウントが編集できるフォルダにしてください。
            </>
          }
        >
          <span className="pf-change">
            <input id="d-pdfFolder" className="in" type="text" value={link} placeholder="新しいフォルダのリンクを貼る" onChange={(e) => setLink(e.target.value)} />
            <button className="btn sub" disabled={busy || !link.trim()} onClick={apply}>
              {busy ? '確かめています…' : 'このフォルダにする'}
            </button>
          </span>
          {message && <div className={message.ok ? 'pf-ok' : 'pf-error'}>{message.text}</div>}
        </Row>
      </div>
    </div>
  )
}

/**
 * 標準のひな形（ひな形を作っていないコースに出る。管理者だけが直す：依頼者 2026-11-06 mockups/v116 案B のあと、詳細設定のいちばん下に）。
 * 直すのは、コースのひな形と同じ「ひな形を作る画面」（TemplateOverlay の standard）。年度の設定なので「保存」で学生に届く
 */
function StandardTemplateCard({ draft, changed, onOpen }: { draft: YearConfig; changed: boolean; onOpen: () => void }) {
  const template = standardTemplate(draft)
  const users = draft.courses.filter((c) => !c.hidden && !c.template?.length).map((c) => `${courseName(c)} コース`)
  return (
    <div className="card std-template">
      <h2 className="card-h">
        <span className="set-ic t-template">{AdminIcon.template}</span>標準のひな形<small>ひな形を作っていないコースに出ます</small>
      </h2>
      <div className="grid">
        <Row label="今の組み立て" changed={changed} field="standardTemplate" hint={template === DEFAULT_TEMPLATE ? 'はじめの形のままです' : 'この年度で直してあります（ひな形を作る画面の「はじめの形に戻す」で戻せます）'}>
          <div className="plain">
            <b>{chapterTitles(template)}</b>
          </div>
        </Row>
        <Row label="使っているコース">
          <div className="plain">{users.length ? users.join('、') : '今はありません（どのコースも、ひな形を作っています）'}</div>
        </Row>
        <Row label="直す" hint="コースのひな形と同じ画面で直します。すでに書き始めた学生の原稿は変わりません。">
          <button className="btn sub sm std-open" onClick={onOpen}>
            {AdminIcon.template}ひな形を作る画面を開く
          </button>
        </Row>
      </div>
    </div>
  )
}

export function DetailsSection({
  draft,
  set,
  changed,
  notices,
  onOpenStandard,
}: {
  draft: YearConfig
  set: (patch: Partial<YearConfig>) => void
  changed: (path: string) => boolean
  notices?: ReactNode
  /** 標準のひな形を直す画面を開く */
  onOpenStandard: () => void
}) {
  const off = draft.driveSave === 'off'
  // 入れている途中の値（範囲の外でも）をそのまま見せる。省略は、はじめの値
  const margins: PageMargins = { ...DEFAULT_MARGINS, ...draft.margins }
  const setMargins = (patch: Partial<PageMargins>) => set({ margins: { ...margins, ...patch } })
  const marginsChanged = changed('margins.top') || changed('margins.bottom') || changed('margins.side')
  return (
    <>
      <SectionHead title="詳細設定" lead="ふだんは変えません。手順書が変わったときや、Google の障害のときに使います。" />
      {notices}
      <PdfFolderCard />
      <div className="card">
        <h2 className="card-h">
          <span className="set-ic t-notice">{AdminIcon.cloud}</span>Google の障害のとき
        </h2>
        <div className="grid">
          {/* Google の障害や大学の設定変更で学生がログインできないときだけ止める（mockups/v22 ② 案B） */}
          <Row label="ドライブ保存" sub="学生の原稿" changed={changed('driveSave')}>
            <div className={`drive-switch${off ? ' off' : ''}`}>
              <div className="seg2" role="group" aria-label="学生のドライブ保存">
                <button aria-pressed={!off} className={!off ? 'on' : ''} onClick={() => set({ driveSave: 'required' })}>
                  必須（ふだん）
                </button>
                <button aria-pressed={off} className={off ? 'on stop' : 'stop'} onClick={() => set({ driveSave: 'off' })}>
                  止める
                </button>
              </div>
              {off ? (
                <span className="warn">止めているあいだ、学生はログインせずに書けます（原稿はその端末にだけ保存されます）。Google が使えるようになったら「必須」に戻して保存してください。</span>
              ) : (
                <span className="hint">Google の障害や大学の設定変更で、学生がログインできないときだけ「止める」にして保存します。</span>
              )}
            </div>
          </Row>
        </div>
      </div>
      <div className="card">
        <h2 className="card-h">
          <span className="set-ic t-subtitle">{AdminIcon.subtitle}</span>表紙と抄録の言葉
        </h2>
        <div className="grid">
          <Row label="報告書の名前" htmlFor="d-reportName" changed={changed('reportName')} field="reportName">
            <TextInput id="d-reportName" value={draft.reportName} onChange={(v) => set({ reportName: v })} />
          </Row>
          <Row label="表紙の見出し" htmlFor="d-coverHeading" changed={changed('cover.heading')} field="cover.heading">
            <TextInput id="d-coverHeading" value={draft.cover.heading} onChange={(v) => set({ cover: { ...draft.cover, heading: v } })} />
          </Row>
          <Row label="題目の見出し" sub="表紙" htmlFor="d-titleLabel" changed={changed('cover.titleLabel')} field="cover.titleLabel">
            <TextInput id="d-titleLabel" value={draft.cover.titleLabel} onChange={(v) => set({ cover: { ...draft.cover, titleLabel: v } })} />
          </Row>
          <Row label="抄録の見出し" htmlFor="d-abstractHeading" changed={changed('abstract.heading')} field="abstract.heading">
            <TextInput id="d-abstractHeading" value={draft.abstract.heading} onChange={(v) => set({ abstract: { ...draft.abstract, heading: v } })} />
          </Row>
          <Row label="書き出しの例（共通）" sub="抄録" htmlFor="d-openingExample" hint="コースで決めていないときに使います。学生が抄録を書き始めると、はじめから入っている文です（書き始める前は、薄く出します。コースの書き出し例は、コースの「ひな形」で決めます）" changed={changed('abstract.openingExample')}>
            <TextInput id="d-openingExample" value={draft.abstract.openingExample} onChange={(v) => set({ abstract: { ...draft.abstract, openingExample: v } })} />
          </Row>
          <Row label="大学名" htmlFor="d-university" changed={changed('university')} field="university">
            <TextInput id="d-university" value={draft.university} onChange={(v) => set({ university: v })} />
          </Row>
          <Row label="学部名" htmlFor="d-faculty" changed={changed('faculty')} field="faculty">
            <TextInput id="d-faculty" value={draft.faculty} onChange={(v) => set({ faculty: v })} />
          </Row>
          <Row label="学科名" htmlFor="d-department" changed={changed('department')} field="department">
            <TextInput id="d-department" value={draft.department} onChange={(v) => set({ department: v })} />
          </Row>
        </div>
      </div>
      <div className="card">
        <h2 className="card-h">
          <span className="set-ic t-table">{AdminIcon.margin}</span>ページの余白
        </h2>
        <div className="grid">
          <Row label="余白" sub="本文・抄録・目次" htmlFor="d-marginTop" hint={MARGINS_HINT} field="margins" changed={marginsChanged}>
            <span className="range margins">
              <span>
                上<NumberInput id="d-marginTop" label="上の余白（mm）" value={margins.top} onChange={(v) => setMargins({ top: v })} />mm
              </span>
              <span>
                下<NumberInput id="d-marginBottom" label="下の余白（mm）" value={margins.bottom} onChange={(v) => setMargins({ bottom: v })} />mm
              </span>
              <span>
                左右<NumberInput id="d-marginSide" label="左右の余白（mm）" value={margins.side} onChange={(v) => setMargins({ side: v })} />mm
              </span>
            </span>
          </Row>
        </div>
      </div>
      <div className="card">
        <h2 className="card-h">
          <span className="set-ic t-stamp">{AdminIcon.ruler}</span>分量の決まり
        </h2>
        <div className="grid">
          <Row label="抄録の字数" htmlFor="d-minChars" changed={changed('abstract.minChars') || changed('abstract.maxChars')} field="abstract.chars">
            <span className="range">
              <NumberInput id="d-minChars" label="抄録の字数（最少）" value={draft.abstract.minChars} onChange={(v) => set({ abstract: { ...draft.abstract, minChars: v } })} />〜
              <NumberInput label="抄録の字数（最多）" value={draft.abstract.maxChars} onChange={(v) => set({ abstract: { ...draft.abstract, maxChars: v } })} />字
            </span>
          </Row>
          {/* 行数は最少だけ。上限はなく、1ページに収める（依頼者の判断 2026-10-31） */}
          <Row label="抄録の行数" htmlFor="d-minLines" changed={changed('abstract.minLines')} field="abstract.lines">
            <span className="range">
              <NumberInput id="d-minLines" label="抄録の行数（最少）" value={draft.abstract.minLines} onChange={(v) => set({ abstract: { ...draft.abstract, minLines: v } })} />行以上（1ページに収める）
            </span>
          </Row>
          <Row label="本文" htmlFor="d-minPages" changed={changed('body.minPages')} field="body.minPages">
            <span className="range">
              <NumberInput id="d-minPages" label="本文の最低ページ数" value={draft.body.minPages} onChange={(v) => set({ body: { ...draft.body, minPages: v } })} />
              ページ以上
            </span>
          </Row>
          <Row label="作品写真" htmlFor="d-photoPages" hint="空なら上限なし（1ページに写真4枚まで）" changed={changed('workPhotos.maxPages')} field="workPhotos.maxPages">
            <span className="range">
              <OptionalNumberInput id="d-photoPages" value={draft.workPhotos?.maxPages ?? null} placeholder="なし" onChange={(v) => set({ workPhotos: { maxPages: v } })} />
              ページまで
            </span>
          </Row>
        </div>
      </div>
      <div className="card">
        <h2 className="card-h">
          <span className="set-ic t-people">{AdminIcon.idcard}</span>学籍番号
        </h2>
        <div className="grid">
          <Row label="形式" sub="正規表現" htmlFor="d-studentId" hint={STUDENT_ID_HINT} changed={changed('studentIdPattern')} field="studentIdPattern">
            <TextInput id="d-studentId" value={draft.studentIdPattern ?? ''} onChange={(v) => set({ studentIdPattern: v.trim() ? v : null })} placeholder="例：^\d{2}FA[A-Z]?\d{3,4}$" />
          </Row>
        </div>
      </div>
      {/* いちばん下（めったに直さない。上の「Google の障害のとき」を押し下げない：依頼者 2026-11-06） */}
      <StandardTemplateCard draft={draft} changed={changed('standardTemplate')} onOpen={onOpenStandard} />
    </>
  )
}
