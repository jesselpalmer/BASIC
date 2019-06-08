import { Header } from './header'

export class REPL {
  public start(): void {
    const header = new Header()
    header.printWelcome()
        
    console.log('>>>')
  }
}
