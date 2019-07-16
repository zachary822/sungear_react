/**
 * @author zacharyjuang
 * 2019-07-10
 */
import {applyMiddleware, compose, createStore} from 'redux';
import thunk from 'redux-thunk';
import _ from 'lodash';

import reducers from './reducers';

export function loadState() {
  try {
    const serializedState = localStorage.getItem('state');

    if (serializedState === null) {
      return undefined;
    } else {
      return JSON.parse(serializedState);
    }
  } catch (e) {
    return undefined;
  }
}

export function saveState(state) {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem('state', serializedState);
  } catch (e1) {
    try {
      localStorage.setItem('state', '{}');
    } catch (e2) {
      // ignore for now
    }
  }
}


/*
 * Enhancer composer for development. Connects to redux browser extension.
 */
const actionSanitizer = (action) => {
  return action;
};
const stateSanitizer = (state) => {
  return state;
};

const reduxDevtoolsExtensionOptions = {
  actionSanitizer,
  stateSanitizer
};

const persistedState = loadState();

const composeEnhancers = process.env.NODE_ENV !== 'production' &&
typeof window === 'object' &&
window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ?
  window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__(reduxDevtoolsExtensionOptions) : compose;

const store = createStore(
  reducers,
  persistedState,
  composeEnhancers(
    applyMiddleware(
      thunk
    )
  )
);

store.subscribe(_.throttle(function () {
  saveState(store.getState());
}, 1000));

export default store;
