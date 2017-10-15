/**
 * A number, or a string containing a number.
 * @typedef {Object} Message
 * @property {string} messageId - Telegram's message ID
 * @property {string} userId - ID of the one who sent this message
 * @property {string} chatId - ID of the chat that contains this message
 */

/**
 * Message storage wrapper. May further switch to something like Redis.
 */
export class MessageStorage {
  /**
   * @type {[Message]}
   */
  items = []

  /**
   * Adds a message to the storage
   * @param {Message} message - The message object
   */
  add (message) {
    this.items.push(message)
  }

  /**
   * Gets all stored messages from selected user
   * @param {string} userId - User ID
   * @return {[Message]} User messages
   */
  getUserMessages (userId) {
    return this.items.filter(message => message.userId === userId)
  }

  /**
   * Gets all stored messages from selected chat
   * @param {string} chatId - Chat ID
   * @return {[Message]} Chat messages
   */
  getChatMessages (chatId) {
    return this.items.filter(message => message.chatId === chatId)
  }

  /**
   * Gets all stored messages from selected chat
   * @param {string} chatId - Chat ID
   * @return {[Message]} User messages in chat
   */
  getUserMessagesInChat (userId, chatId) {
    return this.items.filter(message => message.userId === userId && message.chatId === chatId)
  }

  /**
   * Deletes all stored messages from selected user
   * @param {string} userId - User ID
   */
  deleteUserMessages (userId) {
    this.items = this.items.filter(message => message.userId !== userId)
  }
}
