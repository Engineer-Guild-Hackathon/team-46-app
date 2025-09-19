import SessionSummaryModal from "./SessionSummaryModal.svelte";

// Sample session data for different scenarios
const moderateSession = {
  wordsRead: 1250,
  wordsLearned: 8,
  timeSpent: 1800000, // 30 minutes
  startTime: Date.now() - 1800000,
};

const shortSession = {
  wordsRead: 250,
  wordsLearned: 2,
  timeSpent: 300000, // 5 minutes
  startTime: Date.now() - 300000,
};

const longSession = {
  wordsRead: 3500,
  wordsLearned: 15,
  timeSpent: 7200000, // 2 hours
  startTime: Date.now() - 7200000,
};

const noWordsLearnedSession = {
  wordsRead: 800,
  wordsLearned: 0,
  timeSpent: 1200000, // 20 minutes
  startTime: Date.now() - 1200000,
};

const meta = {
  title: "Components/SessionSummaryModal",
  component: SessionSummaryModal,
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "light",
    },
  },
};

export default meta;

export const Default = {
  args: {
    isOpen: true,
    sessionData: moderateSession,
    onClose: () => console.log("Modal closed"),
    onGoToFlashcards: () => console.log("Navigate to flashcards"),
  },
};

export const ShortSession = {
  args: {
    isOpen: true,
    sessionData: shortSession,
    onClose: () => console.log("Modal closed"),
    onGoToFlashcards: () => console.log("Navigate to flashcards"),
  },
};

export const LongSession = {
  args: {
    isOpen: true,
    sessionData: longSession,
    onClose: () => console.log("Modal closed"),
    onGoToFlashcards: () => console.log("Navigate to flashcards"),
  },
};

export const NoWordsLearned = {
  args: {
    isOpen: true,
    sessionData: noWordsLearnedSession,
    onClose: () => console.log("Modal closed"),
    onGoToFlashcards: () => console.log("Navigate to flashcards"),
  },
};

export const Closed = {
  args: {
    isOpen: false,
    sessionData: moderateSession,
    onClose: () => console.log("Modal closed"),
    onGoToFlashcards: () => console.log("Navigate to flashcards"),
  },
};
