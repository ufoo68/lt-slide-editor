"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "ja" | "en";

type Messages = typeof messages.ja;

const storageKey = "lt-slide-editor-language";

const messages = {
  ja: {
    appName: "LT Slide Editor",
    languageMode: "Language mode",
    japanese: "日本語",
    english: "English",
    dashboard: "ダッシュボード",
    logout: "ログアウト",
    loading: "読み込み中...",
    authChecking: "認証を確認中...",
    homeTagline: "Markdown slides for lightning talks",
    homeDescription:
      "5〜15分のLTを素早く作るための、MarkdownベースのWebスライド作成ツールです。箇条書き、コード、公開URL共有に絞って、発表資料を軽く作れます。",
    start: "はじめる",
    firebaseConfigRequired: "Firebase設定が必要です",
    firebaseConfigDescription:
      "Cloud Runの環境変数に `NEXT_PUBLIC_FIREBASE_API_KEY` などのFirebase Webアプリ設定を入れて、再デプロイしてください。",
    signIn: "ログイン",
    signUp: "新規登録",
    email: "メール",
    password: "パスワード",
    signInWithEmail: "メールでログイン",
    createAccount: "アカウント作成",
    continueWithGoogle: "Googleで続ける",
    signInFailed: "ログインに失敗しました",
    googleSignInFailed: "Googleログインに失敗しました",
    decksTitle: "スライド一覧",
    deckTab: "発表用スライド",
    mediaTab: "メディア",
    sharedSlidesTab: "共有スライド",
    createDeck: "発表用スライド作成",
    uploadMedia: "メディアアップロード",
    createSharedSlide: "共有スライド作成",
    listLoadFailed: "一覧を読み込めませんでした",
    noDecks: "まだデッキがありません。",
    noMedia: "メディアはまだありません。",
    noSharedSlides: "共有スライドはまだありません。",
    public: "公開",
    private: "非公開",
    updated: "更新",
    view: "閲覧",
    edit: "編集",
    delete: "削除",
    mediaUploadFailed: "メディアをアップロードできませんでした",
    mediaDeleteFailed: "メディアを削除できませんでした",
    sharedSlideDeleteFailed: "共有スライドを削除できませんでした",
    deckDeleteFailed: "発表用スライドを削除できませんでした",
    copyMarkdown: "Markdownをコピー",
    copyMarkdownFailed: "Markdownをコピーできませんでした",
    deckLoading: "デッキを読み込み中...",
    deckLoadFailed: "デッキを読み込めませんでした",
    libraryLoadFailed: "ライブラリを読み込めませんでした",
    mediaLibraryLoadFailed: "メディアライブラリを読み込めませんでした",
    copiedMarkdown: (name: string) => `「${name}」のMarkdownをコピーしました`,
    insertedLibrarySlide: (title: string) => `「${title}」を次のページに追加しました`,
    insertedMediaCurrentPage: (filename: string) => `「${filename}」を現在のページに追加しました`,
    save: "保存",
    saving: "保存中...",
    saveFailed: "保存に失敗しました",
    saved: "保存しました",
    savedRemovedEmpty: (count: number) => `保存しました（空ページを${count}件削除しました）`,
    openPublicUrl: "公開URLを開く",
    presentationTime: "発表時間",
    minutesUnit: "分",
    slidePage: "ページ",
    pageEdit: "ページ編集",
    themeSettings: "テーマ設定",
    slideTheme: "テーマ",
    slideThemeDefault: "Default",
    slideThemeDark: "Dark",
    slideThemeMint: "Mint",
    slideHeader: "ヘッダー",
    slideFooter: "フッター",
    fullMarkdown: "Full Markdown",
    previousPage: "前のページへ",
    nextPage: "次のページへ",
    deletePage: "このページを削除",
    preview: "プレビュー",
    presentationView: "発表表示",
    aiReview: "AIレビュー",
    runAiReview: "AIレビューを実行",
    aiReviewing: "レビュー中...",
    aiReviewEmpty: "AIにレビューしてもらうと、時間配分や伝わりやすさの改善案がここに出ます。",
    aiReviewFailed: "AIレビューに失敗しました",
    aiReviewNotConfigured: "GEMINI_API_KEYが設定されていません",
    aiSeverity: {
      high: "重要",
      medium: "改善",
      low: "軽微",
    },
    close: "閉じる",
    closeSharedSlides: "共有スライドを閉じる",
    closeMediaLibrary: "メディアライブラリを閉じる",
    sharedSlidesLoading: "共有スライドを読み込み中...",
    mediaLoading: "メディアを読み込み中...",
    addToNextPage: "次のページに追加",
    addToCurrentPage: "現在のページに追加",
    addToSharedSlide: "共有スライドに追加",
    clipboardFailed: "クリップボードにコピーできませんでした",
    sharedSlideLoading: "共有スライドを読み込み中...",
    sharedSlideLoadFailed: "共有スライドを読み込めませんでした",
    sharedSlideSavedFailed: "共有スライドを保存できませんでした",
    sharedSlideOnePageOnly: "共有スライドは1ページだけ保存できます",
    sharedSlideSeparatorWarning: "共有スライドは1ページだけです。区切り線 `---` は使えません。",
    markdownEmptyPreview: "Markdownを書くとプレビューされます",
    previous: "前へ",
    next: "次へ",
    previousSlide: "前のスライド",
    nextSlide: "次のスライド",
    noPublicSlides: "公開できるスライドがありません。",
    startTimer: "スタート",
    resetTimer: "リセット",
    exitFullscreen: "終了",
    fullscreen: "全画面",
    updatedLabel: "更新",
    untitled: "無題",
    editing: "編集中",
  },
  en: {
    appName: "LT Slide Editor",
    languageMode: "Language mode",
    japanese: "Japanese",
    english: "English",
    dashboard: "Dashboard",
    logout: "Logout",
    loading: "Loading...",
    authChecking: "Checking authentication...",
    homeTagline: "Markdown slides for lightning talks",
    homeDescription:
      "A Markdown-based slide editor for quickly preparing 5-15 minute lightning talks, focused on bullets, code, and public URL sharing.",
    start: "Get started",
    firebaseConfigRequired: "Firebase configuration required",
    firebaseConfigDescription:
      "Set Firebase Web app environment variables such as `NEXT_PUBLIC_FIREBASE_API_KEY` on Cloud Run, then redeploy.",
    signIn: "Sign in",
    signUp: "Sign up",
    email: "Email",
    password: "Password",
    signInWithEmail: "Sign in with email",
    createAccount: "Create account",
    continueWithGoogle: "Continue with Google",
    signInFailed: "Sign-in failed",
    googleSignInFailed: "Google sign-in failed",
    decksTitle: "Slides",
    deckTab: "Presentation slides",
    mediaTab: "Media",
    sharedSlidesTab: "Shared slides",
    createDeck: "Create presentation",
    uploadMedia: "Upload media",
    createSharedSlide: "Create shared slide",
    listLoadFailed: "Could not load the list",
    noDecks: "No decks yet.",
    noMedia: "No media yet.",
    noSharedSlides: "No shared slides yet.",
    public: "Public",
    private: "Private",
    updated: "Updated",
    view: "View",
    edit: "Edit",
    delete: "Delete",
    mediaUploadFailed: "Could not upload the media",
    mediaDeleteFailed: "Could not delete the media",
    sharedSlideDeleteFailed: "Could not delete the shared slide",
    deckDeleteFailed: "Could not delete the presentation",
    copyMarkdown: "Copy Markdown",
    copyMarkdownFailed: "Could not copy Markdown",
    deckLoading: "Loading deck...",
    deckLoadFailed: "Could not load the deck",
    libraryLoadFailed: "Could not load the library",
    mediaLibraryLoadFailed: "Could not load the media library",
    copiedMarkdown: (name: string) => `Copied Markdown for "${name}"`,
    insertedLibrarySlide: (title: string) => `Added "${title}" to the next page`,
    insertedMediaCurrentPage: (filename: string) => `Added "${filename}" to the current page`,
    save: "Save",
    saving: "Saving...",
    saveFailed: "Save failed",
    saved: "Saved",
    savedRemovedEmpty: (count: number) => `Saved and removed ${count} empty page${count === 1 ? "" : "s"}`,
    openPublicUrl: "Open public URL",
    presentationTime: "Presentation time",
    minutesUnit: "min",
    slidePage: "Page",
    pageEdit: "Page edit",
    themeSettings: "Theme",
    slideTheme: "Theme",
    slideThemeDefault: "Default",
    slideThemeDark: "Dark",
    slideThemeMint: "Mint",
    slideHeader: "Header",
    slideFooter: "Footer",
    fullMarkdown: "Full Markdown",
    previousPage: "Previous page",
    nextPage: "Next page",
    deletePage: "Delete this page",
    preview: "Preview",
    presentationView: "Presentation view",
    aiReview: "AI review",
    runAiReview: "Run AI review",
    aiReviewing: "Reviewing...",
    aiReviewEmpty: "Ask AI to review timing, clarity, and the deck's takeaway.",
    aiReviewFailed: "AI review failed",
    aiReviewNotConfigured: "GEMINI_API_KEY is not configured",
    aiSeverity: {
      high: "High",
      medium: "Medium",
      low: "Low",
    },
    close: "Close",
    closeSharedSlides: "Close shared slides",
    closeMediaLibrary: "Close media library",
    sharedSlidesLoading: "Loading shared slides...",
    mediaLoading: "Loading media...",
    addToNextPage: "Add to next page",
    addToCurrentPage: "Add to current page",
    addToSharedSlide: "Add to shared slide",
    clipboardFailed: "Could not copy to the clipboard",
    sharedSlideLoading: "Loading shared slide...",
    sharedSlideLoadFailed: "Could not load the shared slide",
    sharedSlideSavedFailed: "Could not save the shared slide",
    sharedSlideOnePageOnly: "Shared slides must contain only one page",
    sharedSlideSeparatorWarning: "Shared slides are one page only. The `---` separator cannot be used.",
    markdownEmptyPreview: "Write Markdown to see a preview",
    previous: "Previous",
    next: "Next",
    previousSlide: "Previous slide",
    nextSlide: "Next slide",
    noPublicSlides: "No publishable slides.",
    startTimer: "Start",
    resetTimer: "Reset",
    exitFullscreen: "Exit",
    fullscreen: "Full",
    updatedLabel: "Updated",
    untitled: "Untitled",
    editing: "Editing",
  },
};

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Messages;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function parseLanguage(value: string | null): Language {
  return value === "en" ? "en" : "ja";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    typeof window === "undefined" ? "ja" : parseLanguage(window.localStorage.getItem(storageKey)),
  );

  const value = useMemo<LanguageContextValue>(() => {
    function setLanguage(nextLanguage: Language) {
      setLanguageState(nextLanguage);
      window.localStorage.setItem(storageKey, nextLanguage);
      document.documentElement.lang = nextLanguage;
    }

    return {
      language,
      setLanguage,
      t: messages[language],
    };
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
