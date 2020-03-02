import React from 'react';
import * as Redux from 'redux';
import { Provider, connect } from 'react-redux'
import { combineEpics, createEpicMiddleware } from 'redux-observable';

import { filter, mapTo, mergeMap, map, takeUntil, scan } from 'rxjs/operators';
import { ajax } from 'rxjs/ajax';
import { of, concat, interval, merge } from 'rxjs';

const GET_JOKE = 'GET_JOKE';
const getJoke = data => ({
  type: GET_JOKE,
  payload: {
  }
});

const SET_LOADING = 'SET_LOADING';
const setLoading = value => ({
  type: SET_LOADING,
  payload: {
    value,
  }
});

const SET_JOKE = 'SET_JOKE';
const setJoke = data => ({
  type: SET_JOKE,
  payload: {
    data,
  }
});

const SET_THEMES = 'SET_THEMES';
const setThemes = data => ({
  type: SET_THEMES,
  payload: {
    data,
  }
});

const APPLY_THEME = 'APPLY_THEME';
const applyTheme = data => ({
  type: APPLY_THEME,
  payload: {
    data,
  }
});

const SET_TIMER = 'SET_TIMER';
const setTimer = value => ({
  type: SET_TIMER,
  payload: {
    value,
  }
});

const getJokeEpic = action$ => action$.pipe(
  filter(action => action.type === GET_JOKE),
  mergeMap(action => {
    return concat(
      of(setJoke(null)),
      of(setLoading(true)),
      ajax.getJSON('https://api.chucknorris.io/jokes/categories').pipe(
        map(data => {
          const categories = [];
          categories.push(data[Math.floor(Math.random() * data.length)]);
          categories.push(data[Math.floor(Math.random() * data.length)]);
          categories.push(data[Math.floor(Math.random() * data.length)]);
          return setThemes(categories);
        }),
    ));
  }),
  mergeMap(action => {
    if (action.type === SET_THEMES) {
      return of(action, setLoading(false), setTimer(5))
    }
    return of(action)
  })
);

const timerEpic = action$ => action$.pipe(
  filter(action => action.type === SET_THEMES && action.payload.data.length > 0),
  mergeMap(val => {
    const source = interval(1000);
    const count = source.pipe(scan((acc, _) => acc + 1, 0));
    const stopTimer = count.pipe(filter(val => val > 5))
    return source.pipe(
      map(i => setTimer(5 - (i+1))),
      takeUntil(merge(
        stopTimer,
        action$.pipe(filter(action => action.type === SET_JOKE || action.type === GET_JOKE))
      )),
    )
  }),
  mergeMap(action => {
    if (action.payload.value < 1) {
      return of(action, setThemes([]));
    }
    return of(action);
  }),
)

const setJokeEpic = action$ => action$.pipe(
  filter(action => action.type === SET_JOKE),
  mergeMap(action => of(
    setThemes([]),
    setTimer(0),
  ))
)

const applyThemeEpic = action$ => action$.pipe(
  filter(action => action.type === APPLY_THEME),
  mergeMap(action => {
    return ajax.getJSON(`https://api.chucknorris.io/jokes/random?category=${action.payload.data}`).pipe(map(data => {
      return setJoke(data.value);
    }));
  })
)

const initialState = {
  joke: null,
  themes: [],
  timer: 0,
  timerInteval: null,
  loading: false,
}

const dataReducer = (state=initialState, action) => {
  switch (action.type) {
    case SET_JOKE:
      return {...state, joke: action.payload.data };
    case SET_THEMES:
      return {...state, themes: [...action.payload.data] };
    case SET_TIMER:
      return {...state, timer: action.payload.value };
    case SET_LOADING:
      return {...state, loading: action.payload.value };
    default:
      return state;
  }
}

export const rootEpic = combineEpics(
  getJokeEpic,
  timerEpic,
  setJokeEpic,
  applyThemeEpic
);

const rootReducer = Redux.combineReducers({
  dataReducer,
});

const mapStateToProps = state => ({
  joke: state.dataReducer.joke,
  themes: state.dataReducer.themes,
  loading: state.dataReducer.loading,
  timer: state.dataReducer.timer,
});
  
const mapDispatchToProps = {
  getJoke,
  setJoke,
  setThemes,
  applyTheme,
};

const MainContainer = connect(
  mapStateToProps,
  mapDispatchToProps,
)(class MainContainer extends React.Component {
  getJoke = () => {
    this.props.getJoke();
  };

  onSelectTheme = (e) => {
    const category = e.target.value;
    this.props.applyTheme(category);
  }
  renderThemes = () => {
    const { themes } = this.props;
    return (
      <div>{themes.length < 1 ? null : <select onChange={this.onSelectTheme}><option default></option>{themes.map(theme => <option value={theme}>{theme}</option>)}</select>}</div>
    );
  }
  render() {
    
    return (
      <>
        <button onClick={this.getJoke}>Get a joke</button>{this.props.theme ? <span>{this.props.theme}</span> : null}
        {this.renderThemes()}
        {this.props.timer > 0 ? <div>{this.props.timer}</div> : null}
        {this.props.loading ? <div>Loading...</div> : null}
        {this.props.joke ? <div>{this.props.joke}</div> : null}
      </>
    );
  }
})

export const App = () => {
  const epicMiddleware = createEpicMiddleware();

  const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || Redux.compose;

  const store = Redux.createStore(
    rootReducer,
    composeEnhancers(
      Redux.applyMiddleware(epicMiddleware),
    ),
  );
  epicMiddleware.run(rootEpic);
  return (
    <Provider store={store}>
      <MainContainer />
    </Provider>
  )
}
