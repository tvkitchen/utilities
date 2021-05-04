[![Build Status](https://travis-ci.com/tvkitchen/utilities.svg?branch=main)](https://travis-ci.com/tvkitchen/utilities)

# TV Kitchen: Utilities

This monorepo contains several standalone packages that are useful in the TV Kitchen ecosystem. They might be used by specific 

## Driving Philosophy

TV Kitchen Utilities are standalone packages which the TV Kitchen community has deemed important enough to support. A Utility might provide critical functionality leveraged by an [Appliances](https://github.com/tvkitchen/appliances), or it could provide additional implementation-level functionality beyond what is provided by the [Countertop](https://github.com/tvkitchen/appliances).

## Setting Up

```sh
yarn install
```

This will install project dependencies, link local sibling dependencies (we're using [Yarn Workspaces](https://classic.yarnpkg.com/en/docs/workspaces/)), and build/transpile each package.

## About the TV Kitchen

TV Kitchen is a project of [Bad Idea Factory](https://biffud.com).  Learn more at [the TV Kitchen project site](https://tv.kitchen).
