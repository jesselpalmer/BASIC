import constants from '../../../shared/constants'

export default function end(): void {
  process.exit(constants.ExitCodes.NORMAL)
}
