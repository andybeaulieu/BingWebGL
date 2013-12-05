this._minLatitude = -85.05112878;
this._maxLatitude = 85.05112878;
this._minLongitude = -180;
this._maxLongitude = 180;

/// <summary>
/// Clips a number to the specified minimum and maximum values.
/// </summary>
/// <param name="n">The number to clip.</param>
/// <param name="minValue">Minimum allowable value.</param>
/// <param name="maxValue">Maximum allowable value.</param>
/// <returns>The clipped value.</returns>
function clip(n, minValue, maxValue) {
    return Math.min(Math.max(n, minValue), maxValue);
}

/// <summary>
/// Determines the map width and height (in pixels) at a specified level
/// of detail.
/// </summary>
/// <param name="levelOfDetail">Level of detail, from 1 (lowest detail)
/// to 23 (highest detail).</param>
/// <returns>The map width and height in pixels.</returns>
function MapSize(levelOfDetail) {
    return 256 << levelOfDetail;
}


/// <summary>
/// Converts a point from latitude/longitude WGS-84 coordinates (in degrees)
/// into pixel XY coordinates at a specified level of detail.
/// </summary>
/// <param name="latitude">Latitude of the point, in degrees.</param>
/// <param name="longitude">Longitude of the point, in degrees.</param>
/// <param name="levelOfDetail">Level of detail, from 1 (lowest detail)
/// to 23 (highest detail).</param>
/// <param name="pixelX">Output parameter receiving the X coordinate in pixels.</param>
/// <param name="pixelY">Output parameter receiving the Y coordinate in pixels.</param>
function latLongToPixelXY(latitude, longitude, levelOfDetail) {
    latitude = clip(latitude, _minLatitude, _maxLatitude);
    longitude = clip(longitude, _minLongitude, _maxLongitude);

    var x = (longitude + 180) / 360;
    var sinLatitude = Math.sin(latitude * Math.PI / 180);
    var y = 0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI);

    var mapSize = MapSize(levelOfDetail);
    var pixelX = clip(x * mapSize + 0.5, 0, mapSize - 1);
    var pixelY = clip(y * mapSize + 0.5, 0, mapSize - 1);

    return { x: pixelX, y: pixelY };
}

/// <summary>
/// Converts pixel XY coordinates into tile XY coordinates of the tile containing
/// the specified pixel.
/// </summary>
/// <param name="pixelX">Pixel X coordinate.</param>
/// <param name="pixelY">Pixel Y coordinate.</param>
function pixelXYToTileXY(pixelX, pixelY) {
    tileX = pixelX / 256;
    tileY = pixelY / 256;

    return { x: tileX, y: tileY };
}

/// <summary>
/// Converts a pixel from pixel XY coordinates at a specified level of detail
/// into latitude/longitude WGS-84 coordinates (in degrees).
/// </summary>
/// <param name="pixelX">X coordinate of the point, in pixels.</param>
/// <param name="pixelY">Y coordinates of the point, in pixels.</param>
/// <param name="levelOfDetail">Level of detail, from 1 (lowest detail)
/// to 23 (highest detail).</param>
function pixelXYToLatLong(pixelX, pixelY, levelOfDetail) {
    var mapSize = MapSize(levelOfDetail);
    var x = (clip(pixelX, 0, mapSize - 1) / mapSize) - 0.5;
    var y = 0.5 - (clip(pixelY, 0, mapSize - 1) / mapSize);

    latitude = 90 - 360 * Math.atan(Math.exp(-y * 2 * Math.PI)) / Math.PI;
    longitude = 360 * x;

    return { latitude: latitude, longitude: longitude };
}

/// <summary>
/// Converts tile XY coordinates into pixel XY coordinates of the upper-left pixel
/// of the specified tile.
/// </summary>
/// <param name="tileX">Tile X coordinate.</param>
/// <param name="tileY">Tile Y coordinate.</param>
function tileXYToPixelXY(tileX, tileY) {
    pixelX = tileX * 256;
    pixelY = tileY * 256;
    return { x: pixelX, y: pixelY };
}



/// <summary>
/// Converts tile XY coordinates into a QuadKey at a specified level of detail.
/// </summary>
/// <param name="tileX">Tile X coordinate.</param>
/// <param name="tileY">Tile Y coordinate.</param>
/// <param name="levelOfDetail">Level of detail, from 1 (lowest detail)
/// to 23 (highest detail).</param>
/// <returns>A string containing the QuadKey.</returns>
function tileXYToQuadKey(tileX, tileY, levelOfDetail) {
    var quadKey = '';
    for (var i = levelOfDetail; i > 0; i--) {
        var digit = '0';
        var mask = 1 << (i - 1);
        if ((tileX & mask) != 0) {
            digit++;
        }
        if ((tileY & mask) != 0) {
            digit++; digit++;
        }
        quadKey += digit;
    } //for i 
    return quadKey;
}

/// <summary>
/// Determines the ground resolution (in meters per pixel) at a specified
/// latitude and level of detail.
/// </summary>
/// <param name="latitude">Latitude (in degrees) at which to measure the
/// ground resolution.</param>
/// <param name="levelOfDetail">Level of detail, from 1 (lowest detail)
/// to 23 (highest detail).</param>
/// <returns>The ground resolution, in meters per pixel.</returns>
function groundResolution(latitude, levelOfDetail) {
    latitude = clip(latitude, _minLatitude, _maxLatitude);
    return Math.cos(latitude * Math.PI / 180) * 2 * Math.PI * _earthRadius / MapSize(levelOfDetail);
}


function radiansToDeg(val) {
    var pi = Math.PI;
    var ra_de = (val) * (180 / pi);
    return ra_de;
}
function degToRadians(val) {
    var pi = Math.PI;
    var de_ra = (val) * (pi / 180);
    return de_ra;
}

function getPointAlongLine(x1, y1, x2, y2, distance) {
    var angle = Math.atan2((y2 - y1), (x2 - x1));

    var px = x1 + distance * Math.cos(angle);
    var py = y1 + distance * Math.sin(angle);

    return { x: px, y: py };
}

/// <summary>
/// Returns the distance between two points
/// </summary>
function distanceBetweenPoints(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
}

function directionsToQuery(fromAddr, toAddr) {
    //var fromAddr = JSON.stringify(fromAddr);
    //var toAddr = JSON.stringify(toAddr);

    return "wp.0=" + fromAddr + "&wp.1=" + toAddr;
}

function directionsFromQuery(query) {
    var splitQuery = query.split("&");

    var fromAddr = "", toAddr = "";

    $.each(splitQuery, function (index, part) {
        var splitPart = part.split("=");
        if (index == 0)
            fromAddr = splitPart[1];
        else
            toAddr = splitPart[1];
    });

    return { from: fromAddr, to: toAddr };

}
