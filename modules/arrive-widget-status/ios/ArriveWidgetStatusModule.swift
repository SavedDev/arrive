import ExpoModulesCore
import WidgetKit

public final class ArriveWidgetStatusModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArriveWidgetStatus")

    AsyncFunction("isConfigured") { (promise: Promise) in
      WidgetCenter.shared.getCurrentConfigurations { result in
        switch result {
        case .success(let widgets):
          promise.resolve(
            widgets.contains {
              $0.kind == "ArriveCheckIn" &&
                ($0.family == .accessoryCircular || $0.family == .accessoryRectangular)
            }
          )
        case .failure:
          promise.resolve(false)
        }
      }
    }
  }
}
