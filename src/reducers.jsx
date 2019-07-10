/**
 * @author zacharyjuang
 * 2019-07-10
 */
import {combineReducers} from 'redux';

function query(state = '', action) {
  switch (action.type) {
  case 'SET_QUERY':
    return action.query;
  case 'CLEAR_QUERY':
    return '';
  default:
    return state;
  }
}

function data(state = {}, action) {
  switch (action.type) {
  case 'SET_DATA':
    return action.data;
  case 'CLEAR_DATA':
    return {};
  default:
    return state;
  }
}

const reducers = {
  query,
  data
};

export default combineReducers(reducers);
