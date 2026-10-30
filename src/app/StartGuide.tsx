import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import type { YearConfig } from '../config'
import { findCourse } from '../config'
import type { EditorSnapshot, ReportEditor } from '../editor/reportEditor'
import { FIELD_IDS } from '../layout/document'
import { BAND_SIDE_QUERY } from './bandText'
import { useDialogFocus } from './useDialogFocus'
import { WordIcon } from './WordImport'

/**
 * はじめて使う学生への案内（mockups/v8 案3「表紙の上で順に案内する」）。
 * 表紙のコース欄に光を当ててコースを選ばせ、選んだコースの下書きを本文に入れる。
 * 続けて、学籍番号・氏名・サブタイトルの欄を順に案内する（どの段階でも「あとで」で閉じられる）。
 * 今年度だけ、コースを選んだあとに「Word で書き始めていますか？」と聞き、「はい」なら Word から読み込む（mockups/v24 ① 案C）。
 */

/** word：今年度だけ、コースを選んだあとに「Word で書き始めていますか？」と聞く（mockups/v24 ① 案C） */
export type GuideStep = 'course' | 'word' | 'studentId' | 'name' | 'subtitle' | 'done'

const FIELD_OF: Partial<Record<GuideStep, string>> = {
  course: FIELD_IDS.course,
  studentId: FIELD_IDS.studentId,
  name: FIELD_IDS.name,
  subtitle: FIELD_IDS.subtitleInput,
}
const NEXT: Record<GuideStep, GuideStep | null> = { course: 'studentId', word: 'studentId', studentId: 'name', name: 'subtitle', subtitle: 'done', done: null }
const STEP_LABELS: [GuideStep, string][] = [
  ['course', 'コース'],
  ['word', 'Word'],
  ['studentId', '学籍番号'],
  ['name', '氏名'],
  ['subtitle', 'サブタイトル'],
]

/** 選ぶまで、ほかの操作をできないようにする段階（コースを選ぶ・Word で書き始めているか） */
const isChoiceStep = (step: GuideStep) => step === 'course' || step === 'word'

/** スマホで欄を書いている間、案内と下の書く欄の間に要る高さ（px。紙面の欄1行と、その上下の少しの間） */
const TYPING_ROOM = 64
/** 横向きのスマホで、案内を紙面の横に出すときの、紙面との間（px）と、案内の幅の下限（px。これより狭ければ、横には出さない） */
const SIDE_GAP = 12
const SIDE_MIN_W = 240

/**
 * コースを選ぶ段階（と、Word で書き始めているかを聞く段階）の間だけ、案内を窓として扱う
 * （開くと案内の見出しに移り、Tab で裏のボタンへ行かない。Esc では閉じない）。
 * 段階が変わって外れると、開く前の場所に戻る
 */
function CourseStepFocus({ tip }: { tip: RefObject<HTMLDivElement | null> }) {
  const target = useRef<HTMLDivElement | null>(null)
  // 案内より上に出る窓（「別のタブで開いています」など）がすでに開いていれば、そちらを優先する（案内に移さない・Tab を案内に閉じ込めない）。
  // useDialogFocus より前に書く（同じ部品の useEffect は書いた順に動く。この時点では案内の ref も入っている）
  useEffect(() => {
    target.current = document.querySelector('[aria-modal="true"]:not(.g-tip)') ? null : tip.current
  }, [tip])
  useDialogFocus(target)
  return null
}

/**
 * 見出しにいるときの Shift+Tab：案内の最後のボタンへ（見出しは Tab の順に入らないため、そのままだと裏へ出てしまう）
 */
function wrapToLast(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Tab' || !e.shiftKey) return
  const buttons = e.currentTarget.closest('.g-tip')?.querySelectorAll<HTMLElement>('button:not([disabled])')
  const last = buttons?.[buttons.length - 1]
  if (!last) return
  e.preventDefault()
  last.focus()
}

interface Props {
  editor: ReportEditor
  snap: EditorSnapshot
  config: YearConfig
  /** 学科の設定（コースの一覧など）を読み込めていない */
  configMissing?: boolean
  narrow: boolean
  step: GuideStep
  onStep: (step: GuideStep | null) => void
  onChooseCourse: (courseId: string) => void
  /** 今年度だけ：コースを選んだあとに「Word で書き始めていますか？」と聞く（mockups/v24 ① 案C） */
  wordImport?: boolean
  /** 「はい、Word から読み込む」（ファイルを選ぶ窓を開く） */
  onWordImport?: () => void
  /** 最後の「表紙ができました」で「本文へ進む」「閉じる」を押した（このあと指差し確認を出す。mockups/v27） */
  onFinish?: () => void
  /**
   * コースを選ぶ段階から、バックアップファイルで戻す（作り直したあと・別のパソコンで初めて開いたとき、案内が画面をふさぎ、
   * メニューのバックアップまで3回押す必要があった：学生の試し 4回目 2026-10-30。依頼者の選択 mockups/v77 ② 案A）
   */
  onRestoreBackup?: (file: File) => void
}

export function StartGuide({ editor, snap, config, configMissing, narrow, step, onStep, onChooseCourse, wordImport, onWordImport, onFinish, onRestoreBackup }: Props) {
  const backupRef = useRef<HTMLInputElement>(null)
  const field = FIELD_OF[step]
  const [rect, setRect] = useState<DOMRect | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const prevEditing = useRef<string | null>(null)
  const onFinishRef = useRef(onFinish)
  useEffect(() => {
    onFinishRef.current = onFinish
  })
  const titleId = useId()
  // 指で触れない端末（マウス・キーボードのパソコン）：スマホの形（ブラウザを 150%・200% に拡大したときなど）でも、パソコンと同じく欄の入力欄を開き、
  // 言葉も「Enter で次へ」（前は欄が開かず、打った字がどこにも入らなかった：学生の試し 4回目 2026-10-30）
  const [keyboardFirst] = useState(() => !matchMedia('(any-pointer: coarse)').matches)
  const tap = narrow && !keyboardFirst

  // 案内している欄の位置。PC で入力欄が開いていれば、入力欄に光を当てる（紙面の仮の文字より広いことがある）。
  // 紙面の組み直し・画面の大きさ・キーボード・文字の読み込みなどで位置が変わるため、毎フレーム確かめ、変わったときだけ動かす
  useLayoutEffect(() => {
    let frame = 0
    // はじめは null（段階が変わって、光を当てる欄がなくなったときも、前の段階の位置を消す。前は '' と比べて消さず、
    // 最後の「表紙ができました」が、関係のない表のマスを光らせていた：学生の試し 2026-10-29）
    let last: string | null = null
    const measure = () => {
      let el: HTMLElement | null | undefined = null
      if (field) {
        if (!narrow && editor.getSnapshot().editingId === field) el = document.querySelector<HTMLElement>('.overlay-clip:not([hidden]) .overlay-editor')
        // 表示しているページの欄だけ（開いた直後は、ほかのページも組んでいる途中で、見えないページの欄にも大きさがあるため）
        el ??= [...document.querySelectorAll<HTMLElement>(`.page-viewport.front [data-block-id="${CSS.escape(field)}"]`)].find(
          (e) => e.getBoundingClientRect().width > 0 && !!e.closest('[data-vivliostyle-page-container]')?.classList.contains('is-current'),
        )
      }
      // 紙面の行の中の欄（「（コースを選ぶ）コース」「―（サブタイトル）の衣装制作―」など）は、その行の字の全体に光を当てる。
      // 欄だけだと、光の枠が隣の字を半分に切っていた（「コ」が「ニ」に見えた：試し 2026-10-26b）
      let r = el?.getBoundingClientRect()
      if (el && r && !el.classList.contains('overlay-editor') && getComputedStyle(el).display === 'inline' && el.parentElement) {
        const line = document.createRange()
        line.selectNodeContents(el.parentElement)
        // 空の欄の「（コースを選ぶ）」などは字ではない（::before）ので、欄の枠とあわせた範囲にする
        const lr = line.getBoundingClientRect()
        if (lr.width > 0 && lr.height > 0) {
          const left = Math.min(r.left, lr.left)
          const top = Math.min(r.top, lr.top)
          r = new DOMRect(left, top, Math.max(r.right, lr.right) - left, Math.max(r.bottom, lr.bottom) - top)
        }
      }
      const next = r && r.width > 0 ? r : null
      const key = next ? [next.left, next.top, next.width, next.height].map(Math.round).join() : ''
      if (key !== last) {
        last = key
        setRect(next)
      }
      frame = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [editor, field, narrow])

  // 案内する欄の位置を、しばらく待っても見つけられなかった（このときは、枠なしで吹き出しを出す）
  const [waitedStep, setWaitedStep] = useState<GuideStep | null>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => setWaitedStep(step), 2000)
    return () => clearTimeout(timer)
  }, [step])
  const waitedLong = waitedStep === step

  // 表紙を表示する。PC は案内する欄の入力欄を開く（スマホは、タップしたときにキーボードが出るよう、学生にタップしてもらう）
  useEffect(() => {
    if (editor.getSnapshot().page !== 0) void editor.goToPage(0, 'none')
    if (!tap && field && step !== 'course') editor.openWhenReady(field)
  }, [editor, tap, field, step])

  // 案内している欄を書き終えたら（入力欄を閉じたら）、次の段階へ。
  // ページの絵などで表紙からほかのページへ移って閉じたときは、案内を閉じる（前は次の段階へ進み、表紙へ引き戻していた：学生の試し 2026-10-29）
  // Esc で欄を閉じたときは、案内を閉じる（前は次の欄へ進み、学籍番号を空のまま飛ばした。キーボードでは「あとで入力する」に届かなかった：学生の試し 4回目 2026-10-30）
  const escaped = useRef(false)
  useEffect(() => {
    escaped.current = false
    if (!field || step === 'course') return
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && editor.getSnapshot().editingId === field) escaped.current = true
    }
    document.addEventListener('keydown', esc, true)
    return () => document.removeEventListener('keydown', esc, true)
  }, [editor, field, step])
  useEffect(() => {
    const was = prevEditing.current
    prevEditing.current = snap.editingId
    if (!field || step === 'course' || was !== field || snap.editingId === field) return
    const leftCover = !!snap.layout && snap.layout.kinds[snap.page] !== 'cover'
    onStep(leftCover || escaped.current ? null : NEXT[step])
  }, [snap.editingId, snap.layout, snap.page, field, step, onStep])

  // 「表紙ができました」：「本文へ進む」にフォーカスを移し、Esc で閉じる（前はフォーカスが紙面の欄に残り、Tab 22回でやっと届いた：学生の試し 4回目 2026-10-30）
  useEffect(() => {
    if (step !== 'done') return
    tipRef.current?.querySelector<HTMLButtonElement>('.g-actions .primary')?.focus()
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onStep(null)
      onFinishRef.current?.()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [step, onStep])

  // 表紙の欄の段階で、ページの絵・ページ送りを押した（ほかのページへ移るつもり）：案内を閉じる。欄を閉じたことだけを見ると、
  // 打ちかけのときは移る前に次の段階へ進み、表紙へ引き戻していた（学生の試し 3回目 2026-10-29）
  useEffect(() => {
    if (!field || step === 'course') return
    const leave = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('.thumb-list, .arrow, .bar-arrow, .pager, .page-band')) onStep(null)
    }
    document.addEventListener('pointerdown', leave, true)
    return () => document.removeEventListener('pointerdown', leave, true)
  }, [field, step, onStep])

  // 光を当てる欄。Word で書き始めているかを聞く段階は、どの欄も指さない（画面の真ん中に出し、紙面は一様に暗くする。mockups/v24 ① 案C）
  const spot = step === 'word' ? null : rect

  // スマホで欄を書いている間（紙面の上で書いている。予備の端末では、下から書く欄が出ている）
  // マウス・キーボードの端末（ブラウザを拡大したパソコン）は、欄を書いている間も案内を隠さない（200% で案内の言葉が隠れ、何をすればよいか分からなかった：学生の試し 5回目 2026-10-30）
  const typingOnPhone = tap && !!field && snap.editingId === field
  // 画面の大きさ・キーボードが変わったら、スマホの案内の置き方を決め直す
  const [viewportTick, setViewportTick] = useState(0)
  useEffect(() => {
    if (!narrow) return
    const bump = () => setViewportTick((n) => n + 1)
    window.addEventListener('resize', bump)
    window.visualViewport?.addEventListener('resize', bump)
    return () => {
      window.removeEventListener('resize', bump)
      window.visualViewport?.removeEventListener('resize', bump)
    }
  }, [narrow])

  // スマホの案内の置き方（ふだんは画面の上。コースを選ぶ段階・最後は画面の下：index.css）。
  // - 欄を書いている間：案内と下の書く欄の間に、紙面の欄を見せる高さがないとき（横向き・小さい画面でキーボードが出ているとき）は、
  //   書いている間だけ案内を隠す（tucked。書く欄の上に「表紙・〜を書いています」が出ている）。前は、案内が紙面の欄と書く欄の「完了」に重なっていた
  // - 欄をタップしてもらう間：横向きで、紙面の右（左）に空きがあれば、そこに出す（beside。上に出すと、横向きの小さな紙面の欄を隠していたため）
  useLayoutEffect(() => {
    const tip = tipRef.current
    if (!tip) return
    tip.classList.remove('beside', 'tucked')
    tip.style.right = ''
    tip.style.maxHeight = ''
    // PC の置き方（下の useLayoutEffect）が決める left・top は、スマホのときだけ戻す
    if (!narrow) return
    tip.style.left = ''
    tip.style.top = ''
    if (isChoiceStep(step) || step === 'done' || !field) return
    if (typingOnPhone) {
      // 書く欄（紙面で直接書くときは、キーボードの上の道具。予備の ?direct=0 の端末では、下から出る書く欄）
      const sheet = document.querySelector('.edit-sheet.open, .direct-bar')?.getBoundingClientRect()
      if (sheet && sheet.height > 0 && sheet.top - tip.getBoundingClientRect().bottom < TYPING_ROOM) tip.classList.add('tucked')
      return
    }
    if (!matchMedia(BAND_SIDE_QUERY).matches) return
    const page = document.querySelector('.page-viewport.front [data-vivliostyle-page-container].is-current')?.getBoundingClientRect()
    const stage = document.querySelector('.stage')?.getBoundingClientRect()
    if (!page || !stage || !page.width) return
    const right = window.innerWidth - page.right - SIDE_GAP - 8
    const left = page.left - SIDE_GAP - 8
    if (Math.max(left, right) < SIDE_MIN_W) return
    tip.classList.add('beside')
    tip.style.left = right >= left ? `${page.right + SIDE_GAP}px` : '8px'
    tip.style.right = right >= left ? '8px' : `${window.innerWidth - page.left + SIDE_GAP}px`
    tip.style.top = `${stage.top + 8}px`
    tip.style.maxHeight = `${stage.height - 16}px`
  }, [spot, step, field, narrow, typingOnPhone, viewportTick])

  // 案内の吹き出しを、欄のすぐ下に置く（画面からはみ出さないように）
  useLayoutEffect(() => {
    const tip = tipRef.current
    if (!tip || narrow) return
    if (!spot) {
      tip.style.left = `${(window.innerWidth - tip.offsetWidth) / 2}px`
      tip.style.top = `${Math.max(24, (window.innerHeight - tip.offsetHeight) / 2)}px`
      return
    }
    const left = Math.max(12, Math.min(spot.left - 24, window.innerWidth - tip.offsetWidth - 12))
    const below = spot.bottom + 18
    const top = below + tip.offsetHeight > window.innerHeight - 12 ? Math.max(12, spot.top - tip.offsetHeight - 18) : below
    tip.style.left = `${left}px`
    tip.style.top = `${top}px`
    tip.style.setProperty('--arrow-x', `${Math.max(18, Math.min(spot.left - left + 24, tip.offsetWidth - 30))}px`)
    tip.classList.toggle('above', top < spot.top)
  }, [spot, step, narrow])

  const course = findCourse(config, snap.report.basicInfo.courseId)
  const [subtitleBefore, subtitleAfter] = course ? course.subtitleTemplate.split('{input}') : ['', '']
  const pad = 8
  const close = () => onStep(null)
  // 「Word」の段は、今年度だけ出す
  const stepLabels = wordImport ? STEP_LABELS : STEP_LABELS.filter(([s]) => s !== 'word')
  const index = stepLabels.findIndex(([s]) => s === step)
  // コースを選ぶ段階の見出し：開いたときはここに移る（読み上げで、案内の初めから読まれるように）。
  // 最初のコースのボタンに移すと、そのコースを選んでいるように見えてしまうため、見出しにする（見出しの枠は出さない。CSS）
  const courseTitle = { id: titleId, tabIndex: -1, 'data-autofocus': true, onKeyDown: wrapToLast }

  const body = (() => {
    switch (step) {
      case 'course':
        // コースの一覧を読み込めていないときは、選ばせずに読み込み直してもらう（違うコースの下書きで始めないように）
        if (configMissing)
          return (
            <>
              <h2 {...courseTitle}>コースの一覧を読み込めませんでした</h2>
              <p>通信の状態を確かめて、ページを読み込み直してください。</p>
              <div className="g-actions">
                <button className="primary" onClick={() => location.reload()}>
                  読み込み直す
                </button>
              </div>
            </>
          )
        return (
          <>
            <h2 {...courseTitle}>はじめに、コースを選んでください</h2>
            <p>
              選んだコースの下書き（章立てと、それぞれに<span className="nb">書くことの説明</span>）が本文に入ります。そのあと、表紙の項目を順に案内します。
            </p>
            <div className="g-opts">
              {config.courses
                .filter((c) => !c.hidden)
                .map((c) => (
                  <button key={c.id} onClick={() => onChooseCourse(c.id)}>
                    {c.name} コース
                  </button>
                ))}
            </div>
            <span className="g-note">コースはあとから変えられます（下書きを入れ替えるときは確認します）</span>
            {wordImport && (
              <div className="g-word">
                <b>
                  <WordIcon />
                  Word のひな形で書き始めている人へ
                </b>
                まずコースを選んでください。次の画面で、書いた Word を読み込めます（学籍番号・氏名・サブタイトルも写ります）。
              </div>
            )}
            {onRestoreBackup && (
              <p className="g-backup">
                前に保存したバックアップファイルがあるとき（別のパソコン・作り直したあと）：
                <button type="button" className="link" onClick={() => backupRef.current?.click()}>
                  バックアップから戻す
                </button>
                <input
                  ref={backupRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    // 選び直せるよう空に戻す（確かめる窓で「やめる」を押したあと、同じファイルを選び直せるように）
                    e.target.value = ''
                    if (file) onRestoreBackup(file)
                  }}
                />
              </p>
            )}
          </>
        )
      case 'word':
        return (
          <>
            <h2 {...courseTitle}>Word で書き始めていますか？</h2>
            <p>
              学科が配った Word のひな形（<span className="fn">04_本文.docx</span> など）に書いた分があれば、このツールに写せます。
            </p>
            <div className="g-opts">
              <button className="g-word-opt yes" onClick={onWordImport}>
                <WordIcon />
                <span>
                  はい、Word から読み込む
                  <small>本文の Word と、書いていれば表紙の Word を選びます</small>
                </span>
              </button>
              <button className="g-word-opt no" onClick={() => onStep(snap.report.basicInfo.studentId.trim() ? 'name' : 'studentId')}>
                <span>
                  いいえ、ここから書き始める
                  <small>学籍番号・氏名・サブタイトルを順に案内します</small>
                </span>
              </button>
            </div>
            {/* パソコンも、右の欄の「メニュー」の中（mockups/v37 案C）。スマホのメニューは ≡ だけなので、印も書く（学生の試し 2026-10-29） */}
            <span className="g-note">あとからでも、{narrow ? '右上の ≡（メニュー）' : '右上の「メニュー」'}の「Word で書いた分を読み込む」から読み込めます（今年度だけ）。</span>
          </>
        )
      case 'studentId':
        return (
          <>
            <h2 id={titleId}>学籍番号を入力してください</h2>
            <p>{tap ? '光っている欄をタップして入力し、「完了」を押します。' : '入力したら Enter で次へ進みます。'}</p>
          </>
        )
      case 'name':
        return (
          <>
            <h2 id={titleId}>氏名を入力してください</h2>
            <p>姓と名の間は、全角の空白を入れます（例：文化　花子）。{tap ? '欄をタップして入力します。' : '入力したら Enter で次へ進みます。'}</p>
          </>
        )
      case 'subtitle':
        return (
          <>
            <h2 id={titleId}>サブタイトルを入力してください</h2>
            <p>
              「{subtitleBefore}〇〇{subtitleAfter}」の〇〇の部分だけを入力します。前後は自動で付きます。
              {/* PC は学籍番号の段がとばされることが多く、「Enter で次へ」を見ないまま進んでいた（PC の試し 2026-10-25） */}
              {tap ? '欄をタップして入力します。' : '入力したら Enter で次へ進みます。'}
            </p>
          </>
        )
      case 'done': {
        // 空のまま Enter で進んだ項目（前は、何も入れなくても「表紙ができました」と出ていた。PC の試し 2026-10-24）
        const info = snap.report.basicInfo
        const missing = (
          [
            ['学籍番号', info.studentId],
            ['氏名', info.name],
            ['サブタイトル', info.subtitleInput],
          ] as const
        )
          .filter(([, v]) => !v.trim())
          .map(([label]) => label)
        return (
          <>
            <h2 id={titleId}>{missing.length ? 'まだ入っていない項目があります' : '表紙ができました'}</h2>
            {missing.length > 0 && (
              <p className="g-missing">
                {missing.join('・')}が空です。あとで表紙の欄を{tap ? 'タップ' : 'クリック'}して入力できます。
              </p>
            )}
            <p>
              次は本文を書きます（抄録は、本文を書き終えて先生の許可が出てから書きます）。
              {/* スマホの紙面には薄い字が出ず、まだ書いていない段落は「＋」の印（学生の試し 2026-10-24） */}
              {narrow ? '紙面の「＋」の印は、まだ書いていない段落です。押すと、何を書くかが出ます（印は PDF には出ません）。' : '紙面の薄い字は「ここに何を書くか」の説明で、書き始めると消えます（PDFには出ません）。'}
            </p>
            <div className="g-actions">
              {/* 表紙の次は抄録・目次のページなので、本文の最初のページへ移る */}
              <button
                className="primary"
                onClick={() => {
                  close()
                  editor.goToArea('body')
                  onFinish?.()
                }}
              >
                本文へ進む
              </button>
              <button
                onClick={() => {
                  close()
                  onFinish?.()
                }}
              >
                閉じる
              </button>
            </div>
          </>
        )
      }
    }
  })()

  // 案内する欄の位置がまだ分からない（開いた直後で、紙面がまだ出ていない）間は、光の枠も吹き出しも出さない。
  // 前は、位置が分かる前の枠が画面の左上に一瞬出ていた（はじめて使う学生の試し（3回目））。
  // しばらく待っても見つからなければ（紙面に欄がないなど）、枠なしで吹き出しを出す（コースを選ぶ段階で、何もできなくならないように）
  if (field && step !== 'word' && !rect && !waitedLong) return <div className={`guide step-${step}${narrow ? ' narrow' : ''}`}>{isChoiceStep(step) && <div className="g-block" />}</div>

  // スマホで欄を書いている間は、下から出る書く欄が暗くならないよう、紙面を暗くしない
  return (
    <div className={`guide step-${step}${narrow ? ' narrow' : ''}`}>
      {/* コースを選ぶまで（Word で書き始めているかを答えるまで）は、ほかの操作をできないようにする（指・マウスは g-block、キーボードと読み上げは CourseStepFocus と aria-modal）。
          段階が変わったら、新しい段階の見出しに移す（key） */}
      {isChoiceStep(step) && <div className="g-block" />}
      {isChoiceStep(step) && <CourseStepFocus key={step} tip={tipRef} />}
      {/* 光の枠と、暗くするだけの幕は、別の要素にする（key）。同じ要素を使い回すと、幕の位置（画面の左上）から枠が動いてくるように見えていた */}
      {typingOnPhone ? null : spot ? (
        <div key="spot" className="g-spot" style={{ left: spot.left - pad, top: spot.top - pad, width: spot.width + pad * 2, height: spot.height + pad * 2 }} />
      ) : (
        <div key="dim" className="g-dim" />
      )}
      {/* 案内の中を押しても入力欄から文字のカーソルが外れないようにする（外れると次の段階へ進み、案内が動いてしまう） */}
      <div
        className="g-tip"
        ref={tipRef}
        role="dialog"
        aria-modal={isChoiceStep(step) ? true : undefined}
        aria-label="はじめての案内"
        aria-describedby={titleId}
        onMouseDown={(e) => e.preventDefault()}
      >
        {step !== 'done' && (
          <div className="g-steps">
            {stepLabels.map(([s, label], i) => (
              <span key={s} className={i === index ? 'on' : i < index ? 'past' : ''}>
                {i + 1} {label}
              </span>
            ))}
          </div>
        )}
        {body}
        {!isChoiceStep(step) && step !== 'done' && (
          <button className="g-later" onClick={close}>
            あとで入力する（案内を閉じる）
          </button>
        )}
      </div>
    </div>
  )
}
