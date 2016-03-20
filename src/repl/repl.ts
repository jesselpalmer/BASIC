import { Header } from './header';

export class REPL {
    constructor() {
    }

    start() : void {
        const header = new Header();
        header.printWelcome();
        
        console.log('>>>');
    }
}