/** What the bot needs from storage. Implemented over D1 in production and in memory in tests. */
export interface BotRepo {
  /** Binds the chat to the pending user that owns the code. False if the code is unknown, expired or used. */
  bindChat: (code: string, chatId: number, now: number) => Promise<boolean>;
  /** Deletes the chat's user together with all their data. False if the chat was not linked. */
  deleteByChat: (chatId: number) => Promise<boolean>;
  /** How many upcoming unfinished tasks are tracked for the chat; null if the chat is not linked. */
  trackedTasks: (chatId: number, now: number) => Promise<number | null>;
  /** "Already done": no more reminders for the task. False if the chat or the task is unknown. */
  muteTask: (chatId: number, taskKey: string) => Promise<boolean>;
  /** "Remind later": skip the task until `until` and let its last reminder go out again afterwards. */
  snoozeTask: (chatId: number, taskKey: string, until: number) => Promise<boolean>;
}

export interface BotCore {
  start: (chatId: number, payload: string) => Promise<string>;
  stop: (chatId: number) => Promise<string>;
  status: (chatId: number) => Promise<string>;
  help: () => string;
  /** Handles a press on a reminder button; returns the short answer shown to the user. */
  taskAction: (chatId: number, action: 'done' | 'snooze', taskKey: string) => Promise<string>;
}
