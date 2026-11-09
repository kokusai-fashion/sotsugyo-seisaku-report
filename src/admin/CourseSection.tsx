import { useId, useRef, useState, type ReactNode } from 'react'
import type { Course, YearConfig } from '../config'
import { AdminIcon } from './adminIcons'
import { LIMITS } from '../config/validate'
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
 * 「コースごとの設定」の区切り。はじめはコースの一覧（1コース1行）で、押すと、そのコースの設定の画面に入る（ほかのコースは出さない）。
 * 「‹ コースの一覧」で戻る（依頼者の選択 2026-11-07 案1。前は一覧の中でその場で広げていて、縦に長く見づらかった）。
 * この端末で最後に入っていたコースを覚えておき、次に管理ページを開いたときは、そのコースの画面から始める（useOpenCourse）。
 * 管理者：コース名（欄の外に「コース」）・指導教員・お知らせ・ひな形・サブタイトル（「―」は欄の外）。並べ替えは ⋮⋮ をドラッグ。
 * 先生（teacher）：指導教員（見るだけ）・お知らせ・ひな形だけ。学生に表示しないコースは出さない。
 * 先生の許可・点検表（「点検表を開く」「学生の並びを直す」）は、管理者と先生の両方（依頼者の選択 2026-11-04。mockups/v103）
 */

/** お知らせの説明（1行の説明にした：mockups/v114 案C） */
export const NOTICE_HINT = '学生の画面の、セルフチェックの上に出ます'
/** サブタイトルを使わないときの説明 */
const SUBTITLE_OFF_HINT = '表紙と抄録にサブタイトルの行を出しません。学生も入力しません'
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
const CHECK_SHEET_HINT = '学生がコースと氏名を入れると、自動で載ります。見られるのは、PDF の控えのフォルダを見られる先生方です。'
/** 所属の説明（依頼者の選択 2026-11-09 mockups/v119） */
const GROUP_HINT = '制作グループなど。学生は、はじめて使うときに、この中から自分の所属を選びます。点検表は、所属ごとに並びます。'
/** 並び順で等分するときの説明（依頼者の選択 2026-11-09） */
const SPLIT_HINT = '学生には聞きません。点検表の並びを上から等分して班にします（人数が変わったら分け直します）。担当の割り振りに使えます。'
/** まとまりを使わないときの説明 */
const GROUP_NONE_HINT = '点検表を、所属や班に分けずに並べます。'
/** 点検表の順番・並べ方の説明 */
const SHEET_ORDER_HINT = '所属の中（所属を使わないときは全員）を、この順番に並べます。1人ずつ動かすときは「学生の並びを直す」から。'

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
  /**
   * 先生の担当のコース（依頼者の判断 2026-11-09：先生は担当のコースだけ）。渡すと、コースの一覧を出さず、このコースをいつも開いておく
   * （「‹ コースの一覧」も出さない）。この年度にそのコースがなければ、そう知らせる
   */
  only?: string
}

export function CourseSection({ draft, base, teacher = false, openId, onOpen, onFocusCourse, setCourse, onMove, onAdd, onRemove, publishedIds, onOpenTemplate, onEditTemplate, notices, checkSheets, only }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const order = useReorder(listRef, teacher ? 0 : draft.courses.length, (from, to) => onMove?.(from, to), '.course')
  const shown = draft.courses.map((c, i) => ({ c, i })).filter(({ c }) => (!teacher || !c.hidden) && (!only || c.id === only))
  // スマホは「‹ コースの一覧」を、画面のいちばん上の戻る所に出す（AdminApp の Work。戻る所が2つ並ばないように）
  const phone = usePhone()
  const current = shown.find(({ c }) => c.id === (only ?? openId))
  if (only && !current)
    return (
      <>
        <SectionHead title="コースごとの設定" lead="この年度には、担当のコースがありません。上で年度を切り替えるか、「氏名と担当コース」（パソコンは左下、スマホは一覧のいちばん下）で担当のコースを確かめてください。" />
        {notices}
      </>
    )
  if (current) {
    const { c, i } = current
    const advisors = c.advisors.filter((a) => a.trim())
    return (
      <>
        {!phone && !only && (
          <button type="button" className="course-back" onClick={() => onOpen(null)}>
            <span aria-hidden="true">‹</span>コースの一覧
          </button>
        )}
        <SectionHead title={`${courseName(c)} コース`} lead={`指導教員：${advisors.join('、') || 'まだいません'}`} />
        {notices}
        <CourseItem
          course={c}
          base={base}
          draft={draft}
          teacher={teacher}
          open
          onToggle={() => onOpen(null)}
          onFocus={() => onFocusCourse(c.id)}
          onChange={(course) => setCourse(i, course)}
          grip={null}
          dragging={false}
          published={!!publishedIds?.has(c.id)}
          onRemove={() => onRemove?.(i)}
          onOpenTemplate={() => onOpenTemplate(i)}
          onEditTemplate={() => onEditTemplate(i)}
          field={`courses.${i}`}
          checkSheetUrl={checkSheets?.[c.id]}
        />
      </>
    )
  }
  return (
    <>
      <SectionHead title="コースごとの設定" lead={teacher ? 'コースを押して、お知らせとひな形を直します。' : <>学生が最初に選ぶコースです。押すと、そのコースの設定に入ります。並べ替えは <GripMark /> をドラッグします。</>} />
      {notices}
      <div className="course-list" ref={listRef}>
        {shown.map(({ c, i }) => (
          <CourseItem
            key={c.id}
            course={c}
            base={base}
            draft={draft}
            teacher={teacher}
            open={false}
            onToggle={() => onOpen(c.id)}
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
  // 一覧の1行：押すと、そのコースの設定の画面に入る（つまみ以外は、どこを押してもよい）
  if (!open)
    return (
      <div className={`course${course.hidden ? ' hidden-course' : ''}${dragging ? ' dragging' : ''}`} data-course-id={course.id}>
        <div className={`crow${grip ? '' : ' nogrip'}`}>
          {/* 並べ替えのつまみ（カードの左上）。つかんで上下に動かす。キーボードでは ↑・↓ */}
          {grip && (
            <button className="grip" {...grip}>
              ⋮⋮
            </button>
          )}
          <button type="button" className="cmain open-btn" onClick={onToggle} onFocus={onFocus}>
            <span className="ctext">
              <b className="cname">{courseName(course)} コース</b>
              <span className="adv">指導教員：{advisors.join('、') || 'まだいません'}</span>
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
            </span>
            <span className="cgo" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      </div>
    )
  // コースの設定の画面（コース名と指導教員は、区切りの見出しに出す）
  return (
    <div className="course open page" data-course-id={course.id} onFocus={onFocus} onClick={onFocus}>
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
          <Row label="ひな形" sub="下書き" changed={changed('template') || changed('abstractExample')} hint={teacher && !phone ? '組み立ては右の見本のとおりです' : undefined} icon={AdminIcon.template} tone="t-template">
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
              {phone ? (
                // スマホ：ひな形を作る画面はパソコン用（紙面・ページの一覧・右の欄を並べるため）。スマホでは、学生が最初に見る形で見る（管理ページの見本。依頼者の選択 2026-11-09）
                <span className="tpl-acts">
                  <button className="btn sub sm tpl-open" onClick={() => window.dispatchEvent(new Event('sotsugyo-admin-show-preview'))}>
                    {AdminIcon.eye}ひな形を見る
                  </button>
                  <small className="tpl-pc">作る・直すのはパソコンで</small>
                </span>
              ) : (
                <span className="tpl-acts">
                  <button className="btn sub sm tpl-open" onClick={onOpenTemplate}>
                    {AdminIcon.template}ひな形を作る画面を開く
                  </button>
                  <button className="link tpl-old" onClick={onEditTemplate}>
                    前の作り方で直す
                  </button>
                </span>
              )}
            </div>
          </Row>
          {/* サブタイトル：使う・使わないは先生も切り替えられる。前後の文字は管理者だけ（依頼者の選択 2026-11-09） */}
          <SubtitleRow course={course} teacher={teacher} changed={changed('subtitleTemplate') || changed('noSubtitle')} onChange={onChange} />
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
        </div>
        {/* 点検表のまとまり（依頼者の選択 2026-11-09 mockups/v120 案C）：点検表（コースごとの Google スプレッドシート）・所属・点検表の並び（と、学生の並びを直す窓）。
            所属と並びは、管理者もそのコースの先生も変えられる（mockups/v119） */}
        <div className="set-group">点検表</div>
        <div className="grid set-list">
          <CheckSheetRow year={draft.fiscalYear} course={course} saved={base.courses.some((c) => c.id === course.id)} url={checkSheetUrl} />
          <GroupRow course={course} saved={base.courses.find((c) => c.id === course.id)} changed={changed('groups') || changed('checkSplit')} onChange={onChange} />
          <SheetOrderRow
            year={draft.fiscalYear}
            course={course}
            savedCourse={base.courses.find((c) => c.id === course.id)}
            unsaved={(['groups', 'checkById', 'checkOneColumn', 'checkSplit'] as const).some((k) => changed(k))}
            changed={changed('checkById') || changed('checkOneColumn')}
            onChange={onChange}
          />
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
 * まだ保存していないコースは、保存してから使う。「学生の並びを直す」は「点検表の並び」の欄（mockups/v120 案C）
 */
function CheckSheetRow({ year, course, saved, url }: { year: number; course: Course; saved: boolean; url?: string }) {
  const [opening, setOpening] = useState(false)
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
    </Row>
  )
}

/**
 * 所属（名前の札。指導教員の欄と同じく、欄に入れて Enter で足す。依頼者の選択 2026-11-09 mockups/v119 ①）。
 * 同じ名前・長すぎる名前は足さずに、欄の下で知らせる
 */
function GroupRow({ course, saved, changed, onChange }: { course: Course; saved?: Course; changed: boolean; onChange: (c: Course) => void }) {
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const groups = course.groups ?? []
  /**
   * まとまりの作り方（依頼者の選択 2026-11-09）：使わない／学生が選ぶ（所属）／並び順で等分（班。学生には聞かない）。
   * 「学生が選ぶ」にして、まだ所属を足していない間も、その形のまま（chooseOpen）
   */
  // はじめから所属があれば「学生が選ぶ」（札を全部消しても、ほかの形に変わらない：2026-11-09 の点検）
  const [chooseOpen, setChooseOpen] = useState(() => (course.groups ?? []).length > 0)
  const mode: 'none' | 'choose' | 'split' = groups.length || chooseOpen ? 'choose' : course.checkSplit ? 'split' : 'none'
  // ほかの形に替えたあと、戻したときに使う（所属の名前・分ける数。この画面を開いている間だけ：2026-11-09 の点検）
  const lastGroups = useRef<string[]>(groups.length ? groups : (saved?.groups ?? []))
  const lastSplit = useRef<number>(course.checkSplit ?? saved?.checkSplit ?? 3)
  const pick = (next: typeof mode) => {
    setProblem(null)
    if (groups.length) lastGroups.current = groups
    if (course.checkSplit) lastSplit.current = course.checkSplit
    setChooseOpen(next === 'choose')
    if (next === 'none') onChange({ ...course, groups: undefined, checkSplit: undefined })
    if (next === 'choose') onChange({ ...course, groups: groups.length ? groups : lastGroups.current.length ? lastGroups.current : undefined, checkSplit: undefined })
    if (next === 'split') onChange({ ...course, groups: undefined, checkSplit: course.checkSplit ?? lastSplit.current })
  }
  const set = (next: string[]) => onChange({ ...course, groups: next.length ? next : undefined })
  const add = () => {
    const name = text.trim()
    if (!name) return setProblem(null)
    if (groups.includes(name)) return setProblem(`「${name}」は、もうあります`)
    if (name.length > LIMITS.group) return setProblem(`所属の名前は${LIMITS.group}字までです`)
    if (groups.length >= LIMITS.groups) return setProblem(`所属は${LIMITS.groups}個までです`)
    set([...groups, name])
    setText('')
    setProblem(null)
  }
  const name = `c-${course.id}-gmode`
  return (
    <Row label="所属" htmlFor={`c-${course.id}-group-mode`} hint={mode === 'split' ? SPLIT_HINT : mode === 'choose' ? (groups.length ? GROUP_HINT : `${GROUP_HINT}所属を入れずに保存すると「使わない」になります。`) : GROUP_NONE_HINT} warn={problem ?? undefined} changed={changed} icon={AdminIcon.people} tone="t-people">
      <div className="seg-pick group-mode" role="radiogroup" aria-label="まとまりの作り方">
        {(
          [
            ['none', '使わない'],
            ['choose', '学生が選ぶ'],
            ['split', '並び順で等分'],
          ] as const
        ).map(([key, label], i) => (
          <label key={key}>
            <input id={i === 0 ? `c-${course.id}-group-mode` : undefined} type="radio" name={name} checked={mode === key} onChange={() => pick(key)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {mode === 'choose' && (
        <div className="tags group-tags">
          {groups.map((g, i) => (
            <span key={`${g}-${i}`} className="tag">
              {g}
              <button aria-label={`${g}を削除`} onClick={() => set(groups.filter((_, j) => j !== i))}>
                ×
              </button>
            </span>
          ))}
          <input
            id={`c-${course.id}-group`}
            className="in tag-input group-input"
            value={text}
            placeholder="所属の名前を入れて Enter"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                add()
              }
            }}
            onBlur={add}
          />
        </div>
      )}
      {mode === 'split' && (
        <div className="split-pick">
          <select className="in" aria-label="分ける数" value={course.checkSplit ?? 3} onChange={(e) => onChange({ ...course, checkSplit: Number(e.target.value) })}>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>つの班に分ける（1班・2班…）</span>
        </div>
      )}
    </Row>
  )
}

/**
 * 点検表の順番（五十音順・学籍番号順）と並べ方（26人からは2列・いつも縦1列。依頼者の選択 2026-11-09 mockups/v119 ①）と、
 * 「学生の並びを直す」の窓（StudentOrderDialog。mockups/v103 案1。この欄に置く：mockups/v120 案C）。
 * 窓の並べ方は、保存してある所属・順番（savedCourse）で決める。まだ保存していないコース・所属や並びを変えて保存していないときは、保存してから使う
 */
function SheetOrderRow({
  year,
  course,
  savedCourse,
  unsaved,
  changed,
  onChange,
}: {
  year: number
  course: Course
  savedCourse?: Course
  unsaved: boolean
  changed: boolean
  onChange: (c: Course) => void
}) {
  const name = `c-${course.id}-sheet`
  const pick = (key: 'checkById' | 'checkOneColumn', on: boolean) => onChange({ ...course, [key]: on || undefined })
  const [ordering, setOrdering] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const warn = !savedCourse ? 'このコースは、保存してから使えます' : unsaved ? '「学生の並びを直す」は、所属と点検表の並びを保存してから使えます' : undefined
  return (
    <Row label="点検表の並び" htmlFor={`c-${course.id}-sheet-order`} hint={SHEET_ORDER_HINT} warn={warn} changed={changed} icon={AdminIcon.sheet} tone="t-sheet">
      <div className="seg-rows">
        <span className="seg-key" id={`${name}-order-label`}>
          順番
        </span>
        <div className="seg-pick" role="radiogroup" aria-labelledby={`${name}-order-label`}>
          <label>
            <input id={`c-${course.id}-sheet-order`} type="radio" name={`${name}-order`} checked={!course.checkById} onChange={() => pick('checkById', false)} />
            <span>五十音順</span>
          </label>
          <label>
            <input type="radio" name={`${name}-order`} checked={course.checkById === true} onChange={() => pick('checkById', true)} />
            <span>学籍番号順</span>
          </label>
        </div>
        <span className="seg-key" id={`${name}-columns-label`}>
          並べ方
        </span>
        <div className="seg-pick" role="radiogroup" aria-labelledby={`${name}-columns-label`}>
          <label>
            <input id={`c-${course.id}-sheet-columns`} type="radio" name={`${name}-columns`} checked={!course.checkOneColumn} onChange={() => pick('checkOneColumn', false)} />
            <span>26人からは2列</span>
          </label>
          <label>
            <input type="radio" name={`${name}-columns`} checked={course.checkOneColumn === true} onChange={() => pick('checkOneColumn', true)} />
            <span>いつも縦1列</span>
          </label>
        </div>
      </div>
      <div className="row-btns sheet-order-btns">
        <button type="button" className="btn sub sm cs-order" disabled={!savedCourse || unsaved} onClick={() => setOrdering(true)}>
          学生の並びを直す
        </button>
      </div>
      {note && (
        <div className="cs-note ok" role="status">
          {note}
        </div>
      )}
      {ordering && savedCourse && (
        <StudentOrderDialog
          year={year}
          course={savedCourse}
          onClose={() => setOrdering(false)}
          onSaved={() => {
            setOrdering(false)
            setNote('学生の並びを保存しました。点検表も、この並びになります')
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
/**
 * サブタイトル：使う・使わない（使わないと、表紙・抄録にサブタイトルの行を出さず、学生にも入れさせない。先生も切り替えられる：依頼者の選択 2026-11-09）と、
 * 使うときの形式（前後の文字。管理者だけ。先生には形式を見せるだけ）
 */
function SubtitleRow({ course, teacher, changed, onChange }: { course: Course; teacher: boolean; changed: boolean; onChange: (c: Course) => void }) {
  const [before, after] = splitSubtitle(course.subtitleTemplate)
  const on = !course.noSubtitle
  const hint = !on ? SUBTITLE_OFF_HINT : teacher ? <span className="example">形式：{subtitleExample(course.subtitleTemplate)}（形式を変えるときは、管理者に頼んでください）</span> : <span className="example">例：{subtitleExample(course.subtitleTemplate)}</span>
  return (
    <Row label="サブタイトル" htmlFor={`c-${course.id}-subtitle-use`} hint={hint} changed={changed} icon={AdminIcon.subtitle} tone="t-subtitle">
      <label className="toggle-label" data-on="使う" data-off="使わない">
        <input id={`c-${course.id}-subtitle-use`} type="checkbox" role="switch" checked={on} onChange={(e) => onChange({ ...course, noSubtitle: e.target.checked ? undefined : true })} />
        表紙と抄録にサブタイトルを入れる
      </label>
      {on && !teacher && (
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
      )}
    </Row>
  )
}
