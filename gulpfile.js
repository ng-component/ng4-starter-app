const pkg = require('./package.json')
const gulp = require('gulp');
const exec = require('child_process').exec;
const del = require ('del');
const runSequence = require('run-sequence');
const concat = require('gulp-concat');
const inlineNg2Template = require('gulp-inline-ng2-template');
const rename = require('gulp-rename');
const uglify = require('gulp-uglify');
const pump = require('pump');
const tsc = require('gulp-typescript');
const rollup = require('rollup');
const nodeResolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');


gulp.task('clean', function(){
  return del([
    'dist/node_modules/**',
    'src/**/*.ngfactory.ts',
    'src/**/*.js',
    'src/**/*.json',
    'src/**/*.map'    
  ]);
});

gulp.task('clean:src', function(){
  return del([
    'src/**/*.ngfactory.ts',
    'src/**/*.js',
    'src/**/*.json',
    'src/**/*.map'
  ]);
});


gulp.task('clean:dist', function(){
  return del([
    'assets/**',
    'dist/**'
  ]);
});

gulp.task('compile:dev', function (cb) {
  exec('"node_modules\\.bin\\tsc" -p tsconfig.json', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('compile:aot', function (cb) {
  exec('"node_modules\\.bin\\ngc" -p tsconfig.prod.json', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('compile:es6', function () {
  return gulp.src(['./src/**/*.ts'])
    .pipe(inlineNg2Template({ base: '/src', useRelativePaths:true }))
    .pipe(tsc({
      "target": "es5",
      "module": "es6",
      "moduleResolution": "node",
      "experimentalDecorators": true,
      "emitDecoratorMetadata": true,
      "lib": ["es6", "dom"]
    }))
    .pipe(gulp.dest('./dist/src'));
});





gulp.task('rollup:app', function(){
  return rollup.rollup( {
    entry: 'dist/src/main.aot.js',
    onwarn: function (warning) {
      // Skip certain warnings

      // should intercept ... but doesn't in some rollup versions
      if (warning.code === 'THIS_IS_UNDEFINED') { return; }
      // intercepts in some rollup versions
      if ( warning.message.indexOf("The 'this' keyword is equivalent to 'undefined'") > -1 ) { return; }

      // console.warn everything else
      console.warn(warning.message);
    },

    plugins: [
          nodeResolve({
            jsnext: true,
            module: true
          }),
          commonjs({
              include: 'node_modules/rxjs/**',
          })
    ]
  })
  .then(function(bundle) {
      bundle.write( {
        format: "iife",
        dest: "dist/app.bundle.js",
        sourceMap: true
      });
  });
});

gulp.task('rollup:module', function() {
  return rollup.rollup({
    entry: pkg.main,
    onwarn: function (warning) {
      // Skip certain warnings

      // should intercept ... but doesn't in some rollup versions
      if (warning.code === 'THIS_IS_UNDEFINED') { return; }
      // intercepts in some rollup versions
      if ( warning.message.indexOf("The 'this' keyword is equivalent to 'undefined'") > -1 ) { return; }

      if ( warning.message.indexOf("treating it as an external dependency") > -1 ) { return; }

      if (warning.message.indexOf("No name was provided for external module") > -1) { return; }

      // console.warn everything else
      console.warn(warning.message);
    }
    
  }).then( function ( bundle ) {
    bundle.write({
      dest: `dist/${pkg.name}.bundle.umd.js`,
      format: 'umd',
      exports: 'named',
      moduleName: pkg.name,
      globals: {
      }
    });
    bundle.write({
      dest: `dist/${pkg.name}.bundle.cjs.js`,
      format: 'cjs',
      exports: 'named',
      moduleName: pkg.name,
      globals: {
      }
    });
    bundle.write({
      dest: `dist/${pkg.name}.bundle.amd.js`,
      format: 'amd',
      exports: 'named',
      moduleName: pkg.name,
      globals: {
      }
    });    
  });
});



gulp.task('bundle:app', function (cb) {
    runSequence('compile:aot', 'compile:es6', 'copy:html', 'rollup:app', cb);
});

gulp.task('bundle:vendor', function() {
    return gulp
        .src([
            "node_modules/core-js/client/shim.min.js",
            "node_modules/zone.js/dist/zone.js"
        ])
        .pipe(concat("vendor.bundle.js"))
        .pipe(gulp.dest('dist'));

});

gulp.task('bundle:css', function() {
    return gulp
        .src(['node_modules/bootstrap/dist/css/bootstrap.min.css',
            'node_modules/bootstrap/dist/css/bootstrap-theme.min.css'])
        .pipe(concat("styles.bundle.css"))
        .pipe(gulp.dest('dist/assets'));

});

gulp.task('bundle:all',['bundle:app','bundle:vendor'], function(cb) {
  runSequence('bundle:css', cb);
});

gulp.task('bundle:module', function(cb){
  runSequence('compile:aot', 'compile:es6',  'copy:html',  'rollup:module', cb);
});

gulp.task('compress', function (cb) {
  pump([
    gulp.src([
      'dist/*.bundle.js',
      'dist/*.bundle.*.js',
      '!dist/**/*.map', 
      '!dist/**/*.min.js'
    ]),
    uglify(),
    rename({ suffix: '.min' }),
    gulp.dest('dist')
  ], cb);
});

gulp.task('build:dev', ['clean:src'], function(cb) {
    runSequence(
      'compile:dev', cb);

});


gulp.task('build:module',['clean:dist', 'clean:src'], function(cb) {
   runSequence(
      'bundle:module',
      'compress',
      'clean'
   , cb);
});


gulp.task('build:app', ['clean:dist', 'clean:src'], function(cb) {
    runSequence(
      'bundle:all',
      'compress',
      'clean', cb);
});


gulp.task('copy:html', function() {
    gulp.src('index.prod.html')
        .pipe(rename('index.html'))
        .pipe(gulp.dest('dist'));
    return gulp.src('src/**/*.html')
        .pipe(gulp.dest('dist/src'));
});

gulp.task('dev', ['build:dev']);
gulp.task('module', ['build:module']);
gulp.task('app', ['build:app']);
gulp.task('default', ['app']);


