// The Buffalo River's access points, upstream to downstream. From brokan.xyz/buffalo, used with permission.
/** A place to put a boat in or take one out. A primitive access has no developed ramp or parking. */
export type AccessPoint = {
  name: string
  isPrimitive: boolean
  coord: {
    longitude: number
    latitude: number
  }
}

export const accessPoints: AccessPoint[] = [
  {
    name: "Dixon Ford",
    isPrimitive: true,
    coord: {
      longitude: -93.46216192086206,
      latitude: 35.82294350243479,
    }
  },
  {
    name: "Boxley Bridge",
    isPrimitive: false,
    coord: {
      longitude: -93.4043809041825,
      latitude: 35.961261498338914
    }
  },
  {
    name: "Ponca Bridge",
    isPrimitive: false,
    coord: {
      longitude: -93.35529319092956,
      latitude: 36.0209086716046
    }
  },
  {
    name: "Steel Creek",
    isPrimitive: false,
    coord: {
      longitude: -93.33627367950766,
      latitude: 36.03906638332816
    }
  },
  {
    name: "Kyles Landing",
    isPrimitive: false,
    coord: {
      longitude: -93.27969026247962,
      latitude: 36.05676699439937
    }
  },
  {
    name: "Erbie",
    isPrimitive: false,
    coord: {
      longitude: -93.21211608310102,
      latitude: 36.07085186523433
    }
  },
  {
    name: "Ozark",
    isPrimitive: false,
    coord: {
      longitude: -93.15973864879996,
      latitude: 36.06438992804982
    }
  },
  {
    name: "Pruitt Landing",
    isPrimitive: false,
    coord: {
      longitude: -93.13607535973395,
      latitude: 36.058003605070745
    }
  },
  {
    name: "Hasty",
    isPrimitive: false,
    coord: {
      longitude: -93.08197516714834,
      latitude: 36.00799620531276,
    }
  },
  {
    name: "Carver",
    isPrimitive: false,
    coord: {
      longitude: -93.04071700995179,
      latitude: 35.98301583556344,
    }
  },
  {
    name: "Mt. Hersey",
    isPrimitive: false,
    coord: {
      longitude: -92.95313444763228,
      latitude: 36.00914258128375,
    }
  },
  {
    name: "Woolum",
    isPrimitive: false,
    coord: {
      longitude: -92.88635813698578,
      latitude: 35.9710382638861,
    }
  },
  {
    name: "Margaret White Access",
    isPrimitive: true,
    coord: {
      longitude: -92.84443282848073,
      latitude: 35.97049566600012,
    }
  },
  {
    name: "Baker Ford",
    isPrimitive: false,
    coord: {
      longitude: -92.81384799159773,
      latitude: 35.981343954578776,
    }
  },
  {
    name: "Tyler Bend",
    isPrimitive: false,
    coord: {
      longitude: -92.76289535562017,
      latitude: 35.988176888832726,
    }
  },
  {
    name: "Grinder's Ferry (HWY 65)",
    isPrimitive: false,
    coord: {
      longitude: -92.74435918066112,
      latitude: 35.9844961614058,
    }
  },
  {
    name: "Gilbert",
    isPrimitive: false,
    coord: {
      longitude: -92.71527081714207,
      latitude: 35.98694052895239,
    }
  },
  {
    name: "Maumee North",
    isPrimitive: false,
    coord: {
      longitude: -92.62981589794708,
      latitude: 36.03468053171808,
    }
  },
  {
    name: "Maumee South",
    isPrimitive: false,
    coord: {
      longitude: -92.63608399359326,
      latitude: 36.0396081503054,
    }
  },
  {
    name: "Spring Creek",
    isPrimitive: false,
    coord: {
      longitude: -92.58426041790614,
      latitude: 36.030142466540454,
    }
  },
  {
    name: "Dillard's Ferry (HWY 14)",
    isPrimitive: false,
    coord: {
      longitude: -92.57718920615116,
      latitude: 36.06665575511875,
    }
  },
  {
    name: "Buffalo Point",
    isPrimitive: false,
    coord: {
      longitude: -92.55540521999374,
      latitude: 36.070070727930215,
    }
  },
  {
    name: "Rush Landing",
    isPrimitive: false,
    coord: {
      longitude: -92.54950026524092,
      latitude: 36.12503136037799,
    }
  },
  {
    name: "Buffalo City - Game and Fish Public Access",
    isPrimitive: false,
    coord: {
      longitude: -92.4406294,
      latitude: 36.1646525
    }
  },
  {
    name: "Buffalo City - White Buffalo Resort",
    isPrimitive: false,
    coord: {
      longitude: -92.4366144,
      latitude: 36.1666345
    }
  },
  {
    name: "Cartney Access",
    isPrimitive: false,
    coord: {
      longitude: -92.3815440,
      latitude: 36.1935538
    }
  },
  {
    name: "Shipps Access",
    isPrimitive: false,
    coord: {
      longitude: -92.35718858519726,
      latitude: 36.21320003158127
    }
  },
  {
    name: "Norfork Access",
    isPrimitive: false,
    coord: {
      longitude: -92.28957363289481,
      latitude: 36.20956465615408
    }
  }
]
