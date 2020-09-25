import { Header } from './header'

export class Repl {
  public start(): void {
    const header = new Header()
    header.printWelcome()
        
    console.log('>>>')
  }
}
