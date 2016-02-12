import MainMenu from './menu/main_menu';

class App {
  
  start() {
    const mainMenu = new MainMenu();
    mainMenu.printWelcome();
  }
}

const app = new App();
app.start();
