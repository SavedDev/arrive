const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const TARGET_NAME = 'ExpoWidgetsTarget';
const CATALOG_NAME = 'ArriveWidgetAssets.xcassets';

const presetIcons = require('../assets/widgets/preset-icons.json');

const imagesets = [
  {
    name: 'ArriveWordmark',
    files: [
      'arrive-activity-wordmark.png',
      'arrive-activity-wordmark@2x.png',
      'arrive-activity-wordmark@3x.png',
    ],
  },
  {
    name: 'ArriveWordmarkDark',
    files: [
      'arrive-activity-wordmark-dark.png',
      'arrive-activity-wordmark-dark@2x.png',
      'arrive-activity-wordmark-dark@3x.png',
    ],
  },
  {
    name: 'ArriveActivityMark',
    files: [
      'arrive-activity-mark.png',
      'arrive-activity-mark@2x.png',
      'arrive-activity-mark@3x.png',
    ],
  },
  ...Object.keys(presetIcons).map((name) => ({
    name: `ArrivePreset${name.charAt(0).toUpperCase()}${name.slice(1)}`,
    files: [`preset-${name}.png`, `preset-${name}@2x.png`, `preset-${name}@3x.png`],
    template: true,
  })),
];

function withWidgetAssetFiles(config) {
  return withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const catalog = path.join(
        modConfig.modRequest.platformProjectRoot,
        TARGET_NAME,
        CATALOG_NAME,
      );
      const sourceDirectory = path.join(modConfig.modRequest.projectRoot, 'assets', 'widgets');

      fs.mkdirSync(catalog, { recursive: true });
      fs.writeFileSync(
        path.join(catalog, 'Contents.json'),
        `${JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2)}\n`,
      );

      for (const imageset of imagesets) {
        const destination = path.join(catalog, `${imageset.name}.imageset`);
        fs.mkdirSync(destination, { recursive: true });
        imageset.files.forEach((filename) => {
          fs.copyFileSync(path.join(sourceDirectory, filename), path.join(destination, filename));
        });
        fs.writeFileSync(
          path.join(destination, 'Contents.json'),
          `${JSON.stringify(
            {
              images: imageset.files.map((filename, index) => ({
                filename,
                idiom: 'universal',
                scale: `${index + 1}x`,
              })),
              info: { author: 'xcode', version: 1 },
              ...(imageset.template
                ? { properties: { 'template-rendering-intent': 'template' } }
                : {}),
            },
            null,
            2,
          )}\n`,
        );
      }

      return modConfig;
    },
  ]);
}

function withWidgetAssetCatalog(config) {
  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const targetUuid = project.findTargetKey(TARGET_NAME);
    if (!targetUuid) {
      throw new Error(`Could not find ${TARGET_NAME} while adding Arrive widget assets.`);
    }

    const catalogPath = `${TARGET_NAME}/${CATALOG_NAME}`;
    const resourcePhases = project.hash.project.objects.PBXResourcesBuildPhase || {};
    const target = project.pbxNativeTargetSection()[targetUuid];
    const resources = target.buildPhases.find((phase) => resourcePhases[phase.value]);
    if (!resources) {
      project.addBuildPhase([catalogPath], 'PBXResourcesBuildPhase', 'Resources', targetUuid);
    } else if (!project.hasFile(catalogPath)) {
      throw new Error(`${TARGET_NAME} already has resources but is missing ${CATALOG_NAME}.`);
    }

    return modConfig;
  });
}

module.exports = function withArriveWidgetAssets(config) {
  return withWidgetAssetCatalog(withWidgetAssetFiles(config));
};
