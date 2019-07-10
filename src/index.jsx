/**
 * @author zachary juang
 */
import React from 'react';
import ReactDOM from 'react-dom';
import {BrowserRouter as Router} from 'react-router-dom';
import './fontawesome';
import {Provider} from 'react-redux';

import 'bootstrap/scss/bootstrap.scss';
import store from './store';
import App from './components/app';

ReactDOM.render(
  <Provider store={store}>
    <Router>
      <App/>
    </Router>
  </Provider>
  ,
  document.getElementById('app')
);
