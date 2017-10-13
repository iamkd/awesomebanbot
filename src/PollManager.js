import { Markup } from 'telegraf'
import { v4 } from 'uuid'

export class Poll {
  banVotes = []
  saveVotes = []

  constructor ({ chatId, initiator, victim }, updateCallback) {
    this.id = v4()
    this.chatId = chatId
    this.initiator = initiator
    this.victim = victim
    this.createdAt = new Date()
    this.updateCallback = updateCallback
  }

  removeVoteIfExists (user) {
    const banIndex = this.banVotes.findIndex(item => item.id === user.id)
    const saveIndex = this.saveVotes.findIndex(item => item.id === user.id)
    if (banIndex >= 0) {
      this.banVotes.splice(banIndex, 1)
    }
    if (saveIndex >= 0) {
      this.saveVotes.splice(banIndex, 1)
    }
  }

  voteBan (user) {
    this.removeVoteIfExists(user)
    this.banVotes.push(user)
    this.updateCallback()
  }

  voteSave (user) {
    this.removeVoteIfExists(user)
    this.saveVotes.push(user)
    this.updateCallback()
  }

  getMessage () {
    switch (this.getStatus()) {
      case 'saved':
        return `${this.victim.first_name} was banned by voting. Thanks ${this.saveVotes.map(vote => vote.first_name).join(', ')}!`

      case 'banned':
        return `${this.victim.first_name} was saved by voting. Thanks ${this.saveVotes.map(vote => vote.first_name).join(', ')}!`

      case 'pending':
      default:
        return {
          text: `User ${this.initiator.first_name} wants to ban ${this.victim.first_name}`,
          extra: Markup.inlineKeyboard([
            Markup.callbackButton(`Ban (${this.banVotes.length}/5)`, `voteban:${this.id}`),
            Markup.callbackButton(`Save (${this.saveVotes.length}/5)`, `votesave:${this.id}`)
          ]).extra()
        }
    }
  }

  getStatus () {
    if (this.saveVotes.length >= 2) {
      return 'saved'
    }
    if (this.banVotes.length >= 2) {
      return 'banned'
    }
    return 'pending'
  }
}

export class PollManager {
  activePolls = new Map();

  constructor (bot) {
    this.bot = bot
  }

  createPoll (params) {
    const { activePolls } = this
    const { telegram } = this.bot

    const poll = new Poll(params)
    activePolls.set(poll.id, poll)

    const { text, extra } = poll.getMessage()
    telegram
      .sendMessage(params.chatId, text, extra)
      .then(({ message_id, chat: { id } }) => {
        poll.updateCallback = async () => {
          const currentStatus = poll.getStatus()
          if (currentStatus === 'banned') {
            await telegram.kickChatMember(id, poll.victim.id, 0)
          }
          if (currentStatus === 'saved' || currentStatus === 'banned') {
            activePolls.delete(poll.id)
          }
          const currentMessage = poll.getMessage()
          telegram.editMessageText(id, message_id, message_id, currentMessage.text, currentMessage.extra)
        }
      })
  }
}
