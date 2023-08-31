export type SyncotropeSettings = {
  logging: LoggingFlags[];
} & UserSettings;

// settings configued by the user in the UI
type UserSettings = {
  targetHeight: number;
  targetWidth: number;
  targetBlur: string;
  zoomRate: number;
  frameRate: number;
  imageDurationSeconds: number;
};

type LoggingFlags = "ffmpeg" | "file-transfer" | "debug";

const defaults: SyncotropeSettings = {
  targetHeight: 1080,
  targetWidth: 1920,
  targetBlur: "50:10",
  zoomRate: 1.001,
  frameRate: 25,
  imageDurationSeconds: 3,
  logging: ["ffmpeg" , "file-transfer" , "debug"],
};

// map settings to an element on the page
const elementMapping: Record<keyof UserSettings, string> = {
  targetHeight: "height",
  targetWidth: "width",
  targetBlur: "blur",
  zoomRate: "zoomRate",
  frameRate: "frameRate",
  imageDurationSeconds: "imageDurationSeconds",
};

function setElementValueById(
  setting: keyof UserSettings,
  value: string | number,
) {
  const stringValue = typeof value !== "string" ? value.toString() : value;
  const id = elementMapping[setting];
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Cannot find element by id: ${id}`);
  }
  if ("value" in element) {
    element.value = stringValue;
  } else {
    throw new Error(`element ${id} is not an input element`);
  }
}

function getElementValueById(setting: keyof UserSettings): string {
  const id = elementMapping[setting];
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Cannot find element by id: ${id}`);
  }
  if ("value" in element && typeof element.value === "string") {
    return element.value;
  } else {
    throw new Error(`element ${id} is not an input element for strings`);
  }
}

export function setDefaultSettingsInUI() {
  for (const setting of Object.keys(elementMapping)) {
    if (setting in elementMapping) {
      setElementValueById(
        setting as keyof UserSettings,
        defaults[setting as keyof UserSettings],
      );
    } else {
      console.log(`Cannot find ${setting} in ${elementMapping}`);
    }
  }
}

export function getSettings(): SyncotropeSettings {
  const foundSettings: Partial<UserSettings> = {};

  for (const setting of Object.keys(elementMapping)) {
    if (setting in elementMapping) {
      const userValue = getElementValueById(setting as keyof UserSettings);

      if (setting === "targetBlur") {
        foundSettings[setting] = userValue;
      } else {
        foundSettings[setting as keyof Omit<UserSettings, "targetBlur">] =
          Number(userValue);
      }
    } else {
      console.log(`Cannot find ${setting} in ${elementMapping}`);
    }
  }

  return populateDefaults(foundSettings);
}

export function populateDefaults(
  given: Partial<SyncotropeSettings>,
): SyncotropeSettings {
  return {
    ...defaults,
    ...given,
  };
}
