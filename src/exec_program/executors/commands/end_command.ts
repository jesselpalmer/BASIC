import constants from '../../../shared/constants'

export function end(): void {
  process.exit(constants.ExitCodes.NORMAL)
}
