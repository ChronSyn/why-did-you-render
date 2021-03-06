import normalizeOptions from './normalizeOptions'
import getDisplayName from './getDisplayName'
import getUpdateInfo from './getUpdateInfo'
import shouldTrack from './shouldTrack'

function patchClassComponent(ClassComponent, displayName, React, options){
  class WDYRPatchedClassComponent extends ClassComponent{
    constructor(props, context){
      super(props, context)
      const renderIsAnArrowFunction = this.render && !ClassComponent.prototype.render
      if(renderIsAnArrowFunction){
        const origRender = this.render
        this.render = () => {
          WDYRPatchedClassComponent.prototype.render.apply(this)
          return origRender()
        }
      }
    }
    render(){
      if(this._prevProps){
        options.notifier(getUpdateInfo({
          Component: ClassComponent,
          displayName,
          prevProps: this._prevProps,
          prevState: this._prevState,
          nextProps: this.props,
          nextState: this.state,
          options
        }))
      }

      this._prevProps = this.props
      this._prevState = this.state

      return super.render && super.render()
    }
  }

  Object.assign(WDYRPatchedClassComponent, ClassComponent, {displayName})

  return WDYRPatchedClassComponent
}

function patchFunctionalComponent(FunctionalComponent, displayName, React, options){
  let _prevProps = undefined

  function WDYRFunctionalComponent(props){
    if(_prevProps){
      options.notifier(getUpdateInfo({
        Component: FunctionalComponent,
        displayName,
        prevProps: _prevProps,
        nextProps: props,
        options
      }))
    }

    _prevProps = props

    return FunctionalComponent(props)
  }

  Object.assign(WDYRFunctionalComponent, FunctionalComponent, {displayName})

  return WDYRFunctionalComponent
}

function createPatchedComponent(componentsMap, Component, displayName, React, options){
  if(Component.prototype && Component.prototype.isReactComponent){
    return patchClassComponent(Component, displayName, React, options)
  }

  return patchFunctionalComponent(Component, displayName, React, options)
}

function getPatchedComponent(componentsMap, Component, displayName, React, options){
  if(componentsMap.has(Component)){
    return componentsMap.get(Component)
  }

  const WDYRPatchedComponent = createPatchedComponent(componentsMap, Component, displayName, React, options)

  componentsMap.set(Component, WDYRPatchedComponent)
  return WDYRPatchedComponent
}

export default function whyDidYouRender(React, userOptions){
  const options = normalizeOptions(userOptions)

  const origCreateElement = React.createElement

  let componentsMap = new WeakMap()

  React.createElement = function(componentNameOrComponent, ...rest){
    const isShouldTrack = (
      typeof componentNameOrComponent === 'function' &&
      shouldTrack(componentNameOrComponent, getDisplayName(componentNameOrComponent), options)
    )

    if(!isShouldTrack){
      return origCreateElement.apply(React, [componentNameOrComponent, ...rest])
    }

    const displayName = (
      componentNameOrComponent &&
      componentNameOrComponent.whyDidYouRender &&
      componentNameOrComponent.whyDidYouRender.customName ||
      getDisplayName(componentNameOrComponent)
    )

    const WDYRPatchedComponent = getPatchedComponent(componentsMap, componentNameOrComponent, displayName, React, options)
    return origCreateElement.apply(React, [WDYRPatchedComponent, ...rest])
  }

  React.__REVERT_WHY_DID_YOU_RENDER__ = () => {
    React.createElement = origCreateElement
    componentsMap = null
    delete React.__REVERT_WHY_DID_YOU_RENDER__
  }

  return React
}
