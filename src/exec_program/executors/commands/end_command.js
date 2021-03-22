import constants from '../../../shared/constants'

export default function end() {
  process.exit(constants.ExitCodes.NORMAL)
}
