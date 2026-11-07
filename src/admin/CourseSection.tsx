import { useId, useRef, useState, type ReactNode } from 'react'
import type { Course, YearConfig } from '../config'
import { AdminIcon } from './adminIcons'
import { courseChanged, courseName } from './changes'
import { server } from './server'
import { StudentOrderDialog } from './StudentOrderDialog'
import { endsWithCourse, joinSubtitle, splitSubtitle, subtitleExample } from './subtitleText'
import { templateSummary } from './templateText'
import { Chip, FieldProblems, GripMark, Row, SectionHead } from './ui'
import { usePhone } from './usePhone'
import { useReorder } from './useReorder'
import { useSlow } from './useWait'
import { SlowNote, Waiting } from './Wait'

/**
 * 「コースごとの設定」の区切り（mockups/v43 案B。はじめは閉じたまま、この端末で最後に開いていたコースを開く：useOpenCourse。コースは1行ずつに閉じておき、「開く」で、その行の中に全部の欄を出す）。
 * 管理者：コース名（欄の外に「コース」）・指導教員・お知らせ・ひな形・サブタイトル（「―」は欄の外）。並べ替えは ⋮⋮ をドラッグ。
 * 先生（teacher）：指導教員（見るだけ）・お知らせ・ひな形だけ。学生に表示しないコースは出さない。
 * 先生の許可・点検表（「点検表を開く」「学生の並びを直す」）は、管理者と先生の両方（依頼者の選択 2026-11-04。mockups/v103）
 */

/** お知らせの説明（1行の説明にした：mockups/v114 案C） */
export const NOTICE_HINT = '学生の画面の、セルフチェックの上に出ます'
/** お知らせの欄の例（依頼者の指定 2026-11-05） */
const NOTICE_EXAMPLE = '例：夏休み明けの初回授業時に、第1回目の途中点検を提出してください。'
/** 表の空の行の説明（ひな形で枠を用意し、少なければ空欄の行のままでよいコースのため） */
const BLANK_ROWS_HINT = '空のままの表の行を、セルフチェックで「空いている所」に数えません（ひな形で表の枠を用意するときに）'
/**
 * 先生の許可の説明（mockups/v103 の言葉。点検表の列の名前だけ、今の点検表に合わせて「抄録許可」にした：
 * 見本のころは「抄録」と書いていたが、点検表の「抄録」は回の列（v106・v107）で、✓ の列は「抄録許可」のため）
 */
const PERMISSION_HINT = '使わないときは今のまま（抄録は学生が自分で「先生の許可が出た」を押す。PDF に「点検用」の印は入らない）'
/** 点検表の説明（点検表は PDF の控えのコースのフォルダに置くので、見られる人はそのフォルダと同じ：依頼者 2026-11-04） */
const CHECK_SHEET_HINT = '学生がコースを選ぶと、ふりがなの順に自動で載ります。見られるのは、PDF の控えのフォルダを見られる先生方です。'

interface Props {
  draft: YearConfig
  /** 保存してある内容（「変更あり」の印を付けるため） */
  base: YearConfig
  teacher?: boolean
  /** 開いているコースの ID（なければ、どれも閉じている） */
  openId: string | null
  onOpen: (id: string | null) => void
  /** 見本に出すコースを選んだ（カードの中を押した・欄に入った） */
  onFocusCourse: (id: string) => void
  setCourse: (i: number, c: Course) => void
  /** 並べ替え（管理者だけ。from 番目を to 番目に） */
  onMove?: (from: number, to: number) => void
  onAdd?: () => void
  onRemove?: (i: number) => void
  /** 公開したことのあるコース（削除できない） */
  publishedIds?: Set<string>
  /** 「ひな形を作る画面を開く」（学生と同じ紙面で作る画面を、管理ページの上に重ねて開く。mockups/v44 案A） */
  onOpenTemplate: (i: number) => void
  /** 「前の作り方で直す」（前のひな形の窓。予備） */
  onEditTemplate: (i: number) => void
  /** 区切りの見出しのすぐ下に出す知らせ（保存した・断られた、入力の誤りなど） */
  notices?: ReactNode
  /** 作ってある点検表の場所（コースの ID → 場所。管理ページを開いたときにサーバーから届く） */
  checkSheets?: Record<string, string>
}

export function CourseSection({ draft, base, teacher = false, openId, onOpen, onFocusCourse, setCourse, onMove, onAdd, onRemove, publishedIds, onOpenTemplate, onEditTemplate, notices, checkSheets }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const order = useReorder(listRef, teacher ? 0 : draft.courses.length, (from, to) => onMove?.(from, to), '.course')
  const shown = draft.courses.map((c, i) => ({ c, i })).filter(({ c }) => !teacher || !c.hidden)
  return (
    <>
      <SectionHead title="コースごとの設定" lead={teacher ? 'コースを開いて、お知らせとひな形を直します。' : <>学生が最初に選ぶコースです。開いて直します。並べ替えは <GripMark /> をドラッグします。</>} />
      {notices}
      <div className="course-list" ref={listRef}>
        {shown.map(({ c, i }) => (
          <CourseItem
            key={c.id}
            course={c}
            base={base}
            draft={draft}
            teacher={teacher}
            open={openId === c.id}
            onToggle={() => onOpen(openId === c.id ? null : c.id)}
            onFocus={() => onFocusCourse(c.id)}
            onChange={(course) => setCourse(i, course)}
            grip={teacher ? null : order.gripProps(i, c.id)}
            dragging={order.drag?.from === i}
            published={!!publishedIds?.has(c.id)}
            onRemove={() => onRemove?.(i)}
            onOpenTemplate={() => onOpenTemplate(i)}
            onEditTemplate={() => onEditTemplate(i)}
            field={`courses.${i}`}
            checkSheetUrl={checkSheets?.[c.id]}
          />
        ))}
        {order.drag?.line != null && <div className="drop-line" style={{ top: order.drag.line }} />}
      </div>
      <div className="sr-only" aria-live="polite">
        {order.message}
      </div>
      {!teacher && onAdd && (
        <button className="add" onClick={onAdd}>
          {AdminIcon.plus}コースを追加
        </button>
      )}
    </>
  )
}

function CourseItem({
  course,
  base,
  draft,
  teacher,
  open,
  field,
  onToggle,
  onFocus,
  onChange,
  grip,
  dragging,
  published,
  onRemove,
  onOpenTemplate,
  onEditTemplate,
  checkSheetUrl,
}: {
  course: Course
  base: YearConfig
  draft: YearConfig
  teacher: boolean
  open: boolean
  /** このコースの誤り・確認の field（validateConfig。courses.n） */
  field: string
  onToggle: () => void
  onFocus: () => void
  onChange: (c: Course) => void
  grip: ReturnType<ReturnType<typeof useReorder>['gripProps']> | null
  dragging: boolean
  published: boolean
  onRemove: () => void
  onOpenTemplate: () => void
  onEditTemplate: () => void
  /** 作ってある点検表の場所（なければ、「点検表を開く」で作る） */
  checkSheetUrl?: string
}) {
  const bodyId = useId()
  const changed = (key?: string) => courseChanged(base, draft, course.id, key)
  // スマホは見本が右になく、「見本を見る」で開く（mockups/v68 案C）
  const phone = usePhone()
  const advisors = course.advisors.filter((a) => a.trim())
  return (
    <div className={`course${open ? ' open' : ''}${course.hidden ? ' hidden-course' : ''}${dragging ? ' dragging' : ''}`} data-course-id={course.id} onFocus={onFocus} onClick={onFocus}>
      <div className={`crow${grip ? "" : " nogrip"}`}>
        {/* 並べ替えのつまみ（カードの左上）。つかんで上下に動かす。キーボードでは ↑・↓ */}
        {grip && (
          <button className="grip" {...grip}>
            ⋮⋮
          </button>
        )}
        <div className="cmain">
          <b className="cname">{courseName(course)} コース</b>
          <span className="adv">指導教員：{advisors.join('、') || 'まだいません'}</span>
          {!open && (
            <span className="chips">
              {changed() && <Chip kind="chg">変更あり</Chip>}
              {course.hidden && <Chip kind="off">学生に表示しない</Chip>}
              {course.notice?.trim() ? (
                <Chip kind="acc">
                  {AdminIcon.notice}お知らせあり
                </Chip>
              ) : (
                <Chip>お知らせなし</Chip>
              )}
              {course.template?.length ? (
                <Chip kind="acc">
                  {AdminIcon.template}独自のひな形
                </Chip>
              ) : (
                <Chip>標準のひな形</Chip>
              )}
            </span>
          )}
        </div>
        <button className="btn sub sm open-btn" aria-expanded={open} aria-controls={open ? bodyId : undefined} onClick={onToggle}>
          {open ? '閉じる' : '開く'}
        </button>
      </div>
      {open && (
        <div className="cbody" id={bodyId}>
          {/* 絵・名前・1行の説明・右のスイッチの並び（mockups/v114 案C）。2つのまとまりに分ける */}
          <div className="set-group">このコースの学生に出すもの</div>
          <div className="grid set-list">
            {teacher ? (
              <Row label="指導教員" hint="変えるときは、管理者に頼んでください" icon={AdminIcon.people} tone="t-people">
                <div className="plain">{advisors.join('、') || 'まだいません'}</div>
              </Row>
            ) : (
              <>
                <NameRow course={course} changed={changed('name') || changed('hidden')} onChange={onChange} />
                <AdvisorRow course={course} changed={changed('advisors')} onChange={onChange} />
              </>
            )}
            <Row label="お知らせ" sub="任意" htmlFor={`c-${course.id}-notice`} hint={NOTICE_HINT} changed={changed('notice')} icon={AdminIcon.notice} tone="t-notice">
              {/* 書いてから消したときは「お知らせなし」に戻す（空の文字のまま残すと、保存していない変更があるように見えるため） */}
              <textarea id={`c-${course.id}-notice`} className="in notice" rows={teacher ? 3 : 2} value={course.notice ?? ''} placeholder={NOTICE_EXAMPLE} onChange={(e) => onChange({ ...course, notice: e.target.value || undefined })} />
            </Row>
            <Row label="ひな形" sub="下書き" changed={changed('template') || changed('abstractExample')} hint={teacher ? (phone ? '組み立ては見本のとおりです' : '組み立ては右の見本のとおりです') : undefined} icon={AdminIcon.template} tone="t-template">
              <div className={`tpl-line${course.template?.length ? '' : ' default'}`}>
                {/* 作ってあるかだけを出す（中身の数の一覧を見て決めることはないため。言葉は「作成済み」「未作成（標準のひな形）」：依頼者 2026-11-05）。数の一覧は、重ねると出る */}
                <b className={`tpl-state${course.template?.length ? ' on' : ''}`} title={templateSummary(course)}>
                  {course.template?.length ? (
                    <>
                      {AdminIcon.done}
                      作成済み
                    </>
                  ) : (
                    '未作成（標準のひな形）'
                  )}
                </b>
                {/* 学生と同じ紙面で作る画面を、管理ページの上に重ねて開く（mockups/v44 案A）。開けないときの予備に、前の窓も残す */}
                <span className="tpl-acts">
                  <button className="btn sub sm tpl-open" onClick={onOpenTemplate}>
                    {AdminIcon.template}ひな形を作る画面を開く
                  </button>
                  <button className="link tpl-old" onClick={onEditTemplate}>
                    前の作り方で直す
                  </button>
                </span>
              </div>
            </Row>
            {!teacher && <SubtitleRow course={course} changed={changed('subtitleTemplate')} onChange={onChange} />}
          </div>
          <div className="set-group">コースで選べること</div>
          <div className="grid set-list">
            {/* 表の空の行（コースごとに決める：依頼者の選択 2026-10-22 案1）。先生は見るだけ（変えるときは管理者に頼む） */}
            {teacher ? (
              <Row label="表の空の行" hint="変えるときは、管理者に頼んでください" icon={AdminIcon.table} tone="t-table">
                <div className="plain">{course.blankRowsOk ? '使わない行は、空のままでよい' : '空の行も、空いている所に数える'}</div>
              </Row>
            ) : (
              <Row label="表の空の行" htmlFor={`c-${course.id}-blankrows`} hint={BLANK_ROWS_HINT} changed={changed('blankRowsOk')} icon={AdminIcon.table} tone="t-table">
                <label className="toggle-label" data-on="使う" data-off="使わない">
                  <input id={`c-${course.id}-blankrows`} type="checkbox" role="switch" checked={course.blankRowsOk === true} onChange={(e) => onChange({ ...course, blankRowsOk: e.target.checked || undefined })} />
                  使わない行は、空のままでよい
                </label>
              </Row>
            )}
            {/* 先生の許可（コースごと。管理者もそのコースの先生も切り替えられる：依頼者の選択 2026-11-04。mockups/v103 ①） */}
            <PermissionRow course={course} changed={changed('permission')} onChange={onChange} />
            {/* 点検表（コースごとの Google スプレッドシート）と、学生の並びを直す窓（mockups/v103 案1） */}
            <CheckSheetRow year={draft.fiscalYear} course={course} saved={base.courses.some((c) => c.id === course.id)} url={checkSheetUrl} />
          </div>
          {/* このコースの誤り・確認（指導教員がいない・4名以上など）は、コースの欄の下に（上の枠に出すと、打っている間に欄がずれた：mockups/v49 G） */}
          <FieldProblems field={field} />
          {!teacher && (
            <div className="cfoot">
              {published ? (
                <span>公開したことのあるコースは、消せません。「学生に表示」を外します。</span>
              ) : (
                <button className="btn sm danger" onClick={onRemove}>
                  このコースを削除
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 先生の許可（mockups/v103 ①）：抄録・提出用の PDF を、先生の許可（点検表の ✓）が出てから。はじめは両方とも切ってある（今のまま）。
 * 先生の画面でも切り替えられる（先生の保存 saveTeacherEdits で送る）
 */
function PermissionRow({ course, changed, onChange }: { course: Course; changed: boolean; onChange: (c: Course) => void }) {
  const set = (key: 'abstract' | 'final', on: boolean) => {
    const next = { ...course.permission, [key]: on }
    const permission = { ...(next.abstract ? { abstract: true } : {}), ...(next.final ? { final: true } : {}) }
    onChange({ ...course, permission: Object.keys(permission).length ? permission : undefined })
  }
  return (
    <Row label="先生の許可" htmlFor={`c-${course.id}-perm-abstract`} hint={PERMISSION_HINT} changed={changed} icon={AdminIcon.stamp} tone="t-stamp">
      <div className="perm-checks">
        <label className="toggle-label" data-on="使う" data-off="使わない">
          <input id={`c-${course.id}-perm-abstract`} type="checkbox" role="switch" checked={course.permission?.abstract === true} onChange={(e) => set('abstract', e.target.checked)} />
          <span>抄録は、先生の許可が出てから書ける</span>
        </label>
        <div className="sw-desc">点検表の「抄録許可」に ✓ を入れて許可します</div>
        <label className="toggle-label" data-on="使う" data-off="使わない">
          <input id={`c-${course.id}-perm-final`} type="checkbox" role="switch" checked={course.permission?.final === true} onChange={(e) => set('final', e.target.checked)} />
          <span>提出用の PDF は、先生の許可が出てから作れる</span>
        </label>
        <div className="sw-desc">点検表の「最終提出可」に ✓ を入れて許可します</div>
      </div>
    </Row>
  )
}

/**
 * 点検表（mockups/v103）：作ってある点検表は、「点検表を開く」がそのままリンク（サーバーに聞かずに、押すとすぐ新しいタブ。依頼者の試し 2026-11-04）。
 * まだないときだけ、サーバーが点検表を作ってから開く：押したらすぐ空のタブを開いておき、場所が届いたらそこへ移す（あとから開くと、ブラウザが新しいタブを止めるため）。
 * 「学生の並びを直す」は窓（StudentOrderDialog）。まだ保存していないコースは、保存してから使う
 */
function CheckSheetRow({ year, course, saved, url }: { year: number; course: Course; saved: boolean; url?: string }) {
  const [opening, setOpening] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [note, setNote] = useState<{ kind: 'ok' | 'ng'; text: string } | null>(null)
  /** この画面で作った点検表の場所（次からは、リンクで開く） */
  const [created, setCreated] = useState<string | null>(null)
  /** 新しいタブを開けなかったとき（ブラウザが止めた）の、押して開くリンク */
  const [link, setLink] = useState<string | null>(null)
  const slow = useSlow(opening)
  const known = url ?? created
  const create = async () => {
    setNote(null)
    setLink(null)
    const win = window.open('', '_blank')
    try {
      win?.document.write('<p style="font:16px sans-serif;color:#5f6675;padding:24px">点検表を用意しています…</p>')
    } catch {
      // 書けなくても、場所が届けば移る
    }
    setOpening(true)
    try {
      const { url } = await server.ensureCheckSheet(year, course.id)
      setCreated(url)
      if (win && !win.closed) {
        win.opener = null
        win.location.href = url
      } else setLink(url)
    } catch (e) {
      win?.close()
      setNote({ kind: 'ng', text: `点検表を開けませんでした：${String((e as Error)?.message ?? e)}` })
    } finally {
      setOpening(false)
    }
  }
  return (
    <Row label="点検表" hint={CHECK_SHEET_HINT} warn={saved ? undefined : 'このコースは、保存してから使えます'} icon={AdminIcon.sheet} tone="t-sheet">
      <div className="row-btns">
        {known && saved ? (
          <a className="btn sub sm cs-open" href={known} target="_blank" rel="noreferrer">
            点検表を開く
          </a>
        ) : (
          <button type="button" className={`btn sub sm cs-open${opening ? ' busy' : ''}`} disabled={!saved || opening} onClick={() => void create()}>
            {opening ? <Waiting text="用意しています…" /> : '点検表を開く'}
          </button>
        )}
        <button type="button" className="btn sub sm cs-order" disabled={!saved} onClick={() => setOrdering(true)}>
          学生の並びを直す
        </button>
        <SlowNote show={slow} />
      </div>
      {link && (
        <a className="cs-link" href={link} target="_blank" rel="noreferrer">
          点検表を新しいタブで開く
        </a>
      )}
      {note && (
        <div className={`cs-note ${note.kind}`} role="status">
          {note.text}
        </div>
      )}
      {ordering && (
        <StudentOrderDialog
          year={year}
          course={course}
          onClose={() => setOrdering(false)}
          onSaved={() => {
            setOrdering(false)
            setNote({ kind: 'ok', text: '学生の並びを保存しました。点検表も、この並びになります' })
          }}
        />
      )}
    </Row>
  )
}

/** コース名（「コース」は欄の外に固定。名前には付けない）と「学生に表示」 */
function NameRow({ course, changed, onChange }: { course: Course; changed: boolean; onChange: (c: Course) => void }) {
  const warnId = useId()
  const warn = endsWithCourse(course.name)
  return (
    <Row label="コース名" htmlFor={`c-${course.id}-name`} changed={changed} icon={AdminIcon.tag} tone="t-tag">
      <span className="name-box">
        <input id={`c-${course.id}-name`} className="in name" value={course.name} placeholder="コース名" aria-describedby={warn ? warnId : undefined} onChange={(e) => onChange({ ...course, name: e.target.value })} />
        <span className="suffix">コース</span>
      </span>
      {warn && (
        <div className="name-warn" id={warnId}>
          名前の最後の「コース」は消してください（表紙では自動で付きます）
        </div>
      )}
      <label className="toggle-label" data-on="出す" data-off="出さない">
        <input type="checkbox" role="switch" checked={!course.hidden} onChange={(e) => onChange({ ...course, hidden: !e.target.checked })} />
        学生に表示
      </label>
    </Row>
  )
}

/** 指導教員（名前の札。欄に入れて Enter で足す） */
function AdvisorRow({ course, changed, onChange }: { course: Course; changed: boolean; onChange: (c: Course) => void }) {
  const [advisor, setAdvisor] = useState('')
  const add = () => {
    const name = advisor.trim()
    if (!name) return
    onChange({ ...course, advisors: [...course.advisors, name] })
    setAdvisor('')
  }
  return (
    <Row label="指導教員" htmlFor={`c-${course.id}-advisor`} hint="抄録に出ます" changed={changed} icon={AdminIcon.people} tone="t-people">
      <div className="tags">
        {course.advisors.map((name, i) => (
          <span key={`${name}-${i}`} className="tag">
            {name}
            <button aria-label={`${name}を削除`} onClick={() => onChange({ ...course, advisors: course.advisors.filter((_, j) => j !== i) })}>
              ×
            </button>
          </span>
        ))}
        <input
          id={`c-${course.id}-advisor`}
          className="in tag-input"
          value={advisor}
          placeholder="氏名を入れて Enter"
          onChange={(e) => setAdvisor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              add()
            }
          }}
          onBlur={add}
        />
      </div>
    </Row>
  )
}

/** サブタイトルの形式：「―」［前］〔学生が入力〕［後ろ］「―」。前後の「―」は固定の印（保存するときに付ける） */
function SubtitleRow({ course, changed, onChange }: { course: Course; changed: boolean; onChange: (c: Course) => void }) {
  const [before, after] = splitSubtitle(course.subtitleTemplate)
  return (
    <Row label="サブタイトル" htmlFor={`c-${course.id}-before`} hint={<span className="example">例：{subtitleExample(course.subtitleTemplate)}</span>} changed={changed} icon={AdminIcon.subtitle} tone="t-subtitle">
      <div className="template">
        <span className="dash" title="この線は自動で付きます">
          ―
        </span>
        <input id={`c-${course.id}-before`} className="in" aria-label="学生が入力する部分の前" value={before} onChange={(e) => onChange({ ...course, subtitleTemplate: joinSubtitle(e.target.value, after) })} />
        <span className="slot">学生が入力</span>
        <input className="in" aria-label="学生が入力する部分の後ろ" value={after} onChange={(e) => onChange({ ...course, subtitleTemplate: joinSubtitle(before, e.target.value) })} />
        <span className="dash" title="この線は自動で付きます">
          ―
        </span>
      </div>
    </Row>
  )
}
