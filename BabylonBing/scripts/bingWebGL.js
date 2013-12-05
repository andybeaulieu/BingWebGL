/////////////////////////////////////////////////////////////////
//
// Bing WebGL using Babylon JS 
//
// demo by Andy Beaulieu - http://www.andybeaulieu.com
//
// see www.babylonjs.com for more info on Babylon JS
//
// LICENSE: This code is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. ANY 
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF 
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE REGENTS
// OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR 
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; 
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF 
// LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) 
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
/////////////////////////////////////////////////////////////////
"use strict";

var BINGWEBGL = BINGWEBGL || {};

BINGWEBGL.Engine = function (babylonEngine) {

    this._babylonEngine = babylonEngine;
    this._playbackRoutePath = true;
    this._useAsync = true;
    this._getElevations = true;

    this._tilesInitialized = false;

    this._earthRadius = 6378137;

    this._scene;
    this._camera;
    this._tileSizeInMap = 64;
    this._tileSize = 256;                    // each tile is 256 x 256
    this._tileList = [];
    this._locationToCheck = 0;               // for this frame, which tile location to check for update
    this._locationsToCheck = null;           // a list of locations around vehicle to check.

    this._tileMeshSubdivisions = 2;          // how many points in the ground mesh?
    this._meanElevation = null;
    this._gridSize = 10;                     // this must be an even number! The size of the tile grid, in X and Y dimension
    this._levelOfDetail = 19;

    this._skybox;

    this._vehicleSpeed = 1;
    this._vehicleElevationY = 1;

    this._centerLatitude = null;
    this._centerLongitude = null;

    this._posCenterMap = null;                      // the tile position of the starting latitude/longitude of the map
    this._posCenterTile = null;                     // the tile position of the starting tile of the map

    this._vehicle = null;
    this._wayPointPath = null;                      // the list of waypoints to navigate in animations
    this._wayPointHitThreshold = 2;          // the threshold to consider "hitting" a waypoint
    this._wayPointCurrentIndex = 0;


    BINGWEBGL.Engine.prototype.createScene = function () {
        //Creation of the scene
        var canvas = document.getElementById("canvas");

        this._scene = new BABYLON.Scene(this._babylonEngine);

        // create the vehicle
        this._vehicle = new BABYLON.Mesh.CreateSphere("vehicle", 10, 4, this._scene);
        this._vehicle.material = new BABYLON.StandardMaterial("vehicle", this._scene);
        this._vehicle.material.emissiveColor = new BABYLON.Color3(1, 1, 0);

        var light0 = new BABYLON.HemisphericLight("Hemi0", new BABYLON.Vector3(0, 1, 0), this._scene);
        light0.diffuse = new BABYLON.Color3(1, 1, 1);
        light0.specular = new BABYLON.Color3(.1, .1, .1);
        light0.groundColor = new BABYLON.Color3(0, 0, 0);

        var bingWebGL = this;

        this._scene.registerBeforeRender(function () {

            if (bingWebGL._tilesInitialized)
                bingWebGL.updateTilesAndPositions();

        });

        this._scene.executeWhenReady(function () {
            // add keyboard controls
            //if (this._scene.activeCamera) {
            //    this._scene.activeCamera.attachControl(canvas);

            //    if (this._scene.activeCamera.keysUp) {
            //        this._scene.activeCamera.keysUp.push(90); // Z
            //        this._scene.activeCamera.keysUp.push(87); // W
            //        this._scene.activeCamera.keysDown.push(83); // S
            //        this._scene.activeCamera.keysLeft.push(65); // A
            //        this._scene.activeCamera.keysLeft.push(81); // Q
            //        this._scene.activeCamera.keysRight.push(69); // E
            //        this._scene.activeCamera.keysRight.push(68); // D
            //    }
            //}
        });

        var camera = new BABYLON.ArcRotateCamera("Camera", 0, 0.8, 10, new BABYLON.Vector3.Zero(), this._scene);
        this._camera = camera;

        //this._camera = new BABYLON.FreeCamera("FreeCamera", new BABYLON.Vector3(0, 400, 5), this._scene);
        //this._camera.setTarget(this._vehicle.position);
        //this._camera.cameraDirection = new BABYLON.Vector3(degToRadians(90), 0, 0);

        this._camera.setPosition(new BABYLON.Vector3(100, 50, 0));
        this._camera.rotation = new BABYLON.Vector3(degToRadians(90), 0, 0);


        // Skybox
        this._skybox = BABYLON.Mesh.CreateBox("skyBox", 800.0, this._scene);
        var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this._scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("skybox/skybox", this._scene);
        skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        this._skybox.material = skyboxMaterial;

        // Camera constraints
        var camerasBorderFunction = function () {

            var extentMax = 200;        // maximum in all directions

            if (camera.position.y < 1)
                camera.position.y = 1;

            if (camera.position.x < -extentMax)
                camera.position.x = -extentMax;
            else
                if (camera.position.x > extentMax)
                    camera.position.x = extentMax;

            if (camera.position.z < -extentMax)
                camera.position.z = -extentMax;
            else
                if (camera.position.z > extentMax)
                    camera.position.z = extentMax;

            // Angle
            if (camera.beta < 0.1)
                camera.beta = 0.1;
            else if (camera.beta > (Math.PI / 2) * 0.9)
                camera.beta = (Math.PI / 2) * 0.9;

            // Zoom
            if (camera.radius > 150)
                camera.radius = 150;

            if (camera.radius < 30)
                camera.radius = 30;
        };

        this._scene.registerBeforeRender(camerasBorderFunction);

        return this._scene;

    }

    BINGWEBGL.Engine.prototype.getDirections = function (directions, levelOfDetail) {

        var wayPoints = [];
        this._wayPointCurrentIndex = 0;

        this._tilesInitialized = false;
        this._locationToCheck = 0;
        this._meanElevation = null;
        // initialize the tiles
        this.setupTiles();

        $("#divErrors").html("");

        for (var xx = 0; xx < this._gridSize; xx++) {
            for (var yy = 0; yy < this._gridSize; yy++) {

                var meshName = "TileMesh_" + xx + "_" + yy;
                var tile = this._scene.getMeshByName(meshName);
                tile.position = new BABYLON.Vector3(-1000, 0, 0); // new BABYLON.Vector3((xx * _tileSizeInMap) - ((_gridSize / 2) * _tileSizeInMap), 1.0, (-yy * _tileSizeInMap) + ((_gridSize / 2) * _tileSizeInMap));
            }
        }

        var bingWebGL = this;

        $.ajax({
            url: "/api/proxy/GetDirections",
            data: JSON.stringify(directions),
            type: "POST",
            dataType: "json",
            contentType: "application/json; charset=utf-8",
            success: function (result) {

                var data = JSON.parse(result);
                // check for any errors
                if (data.errorDetails) {

                    var errMsg = "";
                    $.each(data.errorDetails, function (index, msg) {
                        errMsg += msg + "<br/>";
                    });

                    $("#divErrors").html(errMsg);
                    return;
                }
                if (data.resourceSets &&
                   data.resourceSets.length > 0 &&
                   data.resourceSets[0].resources &&
                   data.resourceSets[0].resources.length > 0 &&
                   data.resourceSets[0].resources[0].routePath &&
                   data.resourceSets[0].resources[0].routePath.line &&
                   data.resourceSets[0].resources[0].routePath.line.coordinates) {
                    for (var j = 0; j < data.resourceSets[0].resources[0].routePath.line.coordinates.length ; j++) {
                        var lineItem = data.resourceSets[0].resources[0].routePath.line.coordinates[j];
                        var lat = lineItem[0];
                        var long = lineItem[1];

                        wayPoints.push({ latitude: lat, longitude: long });
                    }
                }

                bingWebGL._centerLatitude = wayPoints[0].latitude;
                bingWebGL._centerLongitude = wayPoints[0].longitude;

                bingWebGL.setupTilesForArea(bingWebGL._centerLatitude, bingWebGL._centerLongitude, levelOfDetail);

                bingWebGL.setupRoutePath(wayPoints, levelOfDetail, bingWebGL.centerLatitude, bingWebGL.centerLongitude);

            }
        });


    }

    BINGWEBGL.Engine.prototype.getElevations = function (meshName, tileX, tileY) {

        var tile = this._scene.getMeshByName(meshName);
        if (tile != null)
            tile.isVisible = false;

        if (!this._getElevations)
            return;

        var query = "";

        var pixelXY = tileXYToPixelXY(tileX, tileY);

        var latLongsToQuery = [];
        var subdivisions = this._tileMeshSubdivisions;

        for (var row = 0; row <= subdivisions; row++) {
            for (var col = 0; col <= subdivisions; col++) {
                var xPos = pixelXY.x + (col * this._tileSize) / subdivisions - (this._tileSize / 2.0);
                var yPos = pixelXY.y - ((subdivisions - row) * this._tileSize) / subdivisions - (this._tileSize / 2.0);

                latLongsToQuery.push(pixelXYToLatLong(xPos, yPos, this._levelOfDetail));
            }
        }

        $.each(latLongsToQuery, function (index, latLong) {
            query += latLong.latitude + "," + latLong.longitude;
            if (index < latLongsToQuery.length - 1)
                query += ",";
        });

        var bingWebGL = this;

        $.ajax({
            url: "/api/proxy/GetElevations",
            data: JSON.stringify(query),
            type: "POST",
            meshName: meshName,
            async: this._useAsync,
            dataType: "json",
            contentType: "application/json; charset=utf-8",
            success: function (result) {

                var data = JSON.parse(result);

                if (data != null &&
                  data.resourceSets &&
                  data.resourceSets.length > 0 &&
                  data.resourceSets[0].resources &&
                  data.resourceSets[0].resources.length > 0 &&
                  data.resourceSets[0].resources[0].elevations) {

                    var elevations = [];
                    for (var j = 0; j < data.resourceSets[0].resources[0].elevations.length ; j++) {
                        var elevation = data.resourceSets[0].resources[0].elevations[j];

                        elevation = elevation;
                        elevations.push(elevation);

                        if (bingWebGL._meanElevation == null)
                            bingWebGL._meanElevation = elevations[0];
                    }

                    var tile = bingWebGL.createGroundFromElevationData(meshName, elevations, bingWebGL._tileSizeInMap, bingWebGL._tileSizeInMap, bingWebGL._tileMeshSubdivisions, 0, 1000, bingWebGL._scene, true);

                    tile.isVisible = true;
                    console.log("created elevation for" + meshName);
                    //_saveTileData.push({ mesh: meshName, data: elevations });
                }

            }
        });

    }

    BINGWEBGL.Engine.prototype.setupRoutePath = function (wayPoints, levelOfDetail, centerLatitude, centerLongitude) {

        // show the center point
        //var ctrPointMaterial = new BABYLON.StandardMaterial("ctrpoint", this._scene)
        //ctrPointMaterial.emissiveColor = new BABYLON.Color3(0, 0, 1);
        //var ctrPointObject = new BABYLON.Mesh.CreateSphere("ctrpoint", 10, 4, this._scene);
        //ctrPointObject.material = ctrPointMaterial;

        //ctrPointObject.position = latLongToBabylonXY(centerLatitude, centerLongitude, levelOfDetail, 10);

        this._vehicle.position = this.latLongToBabylonXY(this._centerLatitude, this._centerLongitude, levelOfDetail, 10);;

        //var wayPointMaterial = new BABYLON.StandardMaterial("waypoint", this._scene)
        //wayPointMaterial.emissiveColor = new BABYLON.Color3(1, 1, 0);

        var bingWebGL = this;

        $.each(wayPoints, function (index, wayPoint) {
            var wayPointPosition = bingWebGL.latLongToBabylonXY(wayPoint.latitude, wayPoint.longitude, levelOfDetail, 10);

            //var wayPointObject = new BABYLON.Mesh.CreateSphere("waypoint_" + index, 10, 4, this._scene);
            //wayPointObject.material = wayPointMaterial;
            //wayPointObject.position = wayPointPosition;

            wayPoint.targetPosition = { x: wayPointPosition.x, y: wayPointPosition.z };

        });

        // save waypoints for navigation animation
        this._wayPointPath = wayPoints;

    }

    BINGWEBGL.Engine.prototype.updateTilesAndPositions = function () {

        // check for the grid slots around this tile and recycle
        var halfGrid = (this._gridSize / 2) * this._tileSizeInMap;

        var vehiclePosX = Math.floor(this._vehicle.position.x / this._tileSizeInMap) * this._tileSizeInMap;
        var vehiclePosY = Math.floor(this._vehicle.position.z / this._tileSizeInMap) * this._tileSizeInMap;


        // loop from closest to vehicle outward
        var distance = 1;   // check just 1 tile out for missing tiles

        if (this._locationsToCheck == null) {
            this._locationsToCheck = [];
            // fill the locations to check, relative to vehicle at 0,0
            var dirSize = this._gridSize - 1;
            for (var yy = 0; yy < dirSize; yy++) {
                for (var xx = 0; xx < dirSize; xx++) {
                    if (!(xx == 0 && yy == 0)) {
                        this._locationsToCheck.push({ x: xx - Math.floor(dirSize / 2), y: yy - Math.floor(dirSize / 2) });
                    }
                }
            }
        }
        var factorX = this._locationsToCheck[this._locationToCheck].x;
        var factorY = this._locationsToCheck[this._locationToCheck].y;

        var checkX = vehiclePosX + (factorX * distance * this._tileSizeInMap);
        var checkY = vehiclePosY + (factorY * distance * this._tileSizeInMap);

        // see if any tiles already occupy this slot
        var occupied = false;
        var tileClosest = null, tileFarthest = null;
        var tileClosestDistance = Number.MAX_VALUE, tileFarthestDistance = Number.MIN_VALUE;
        for (var i = 0; i < this._tileList.length; i++) {

            if (this._tileList[i].position.x == checkX && this._tileList[i].position.z == checkY) {
                occupied = true;
            }

            // also calculate distance from tile to vehicle
            var distanceBetweenVehicleAndTile = distanceBetweenPoints(vehiclePosX, vehiclePosY, this._tileList[i].position.x, this._tileList[i].position.z);
            if (distanceBetweenVehicleAndTile < tileClosestDistance) {
                tileClosest = this._tileList[i];
                tileClosestDistance = distanceBetweenVehicleAndTile;
            }
            if (distanceBetweenVehicleAndTile > tileFarthestDistance) {
                tileFarthest = this._tileList[i];
                tileFarthestDistance = distanceBetweenVehicleAndTile;
            }

        }

        var rayPick = new BABYLON.Ray(new BABYLON.Vector3(this._vehicle.position.x, 10000, this._vehicle.position.z), new BABYLON.Vector3(0, -1, 0));
        var meshFound = scene.pickWithRay(rayPick, function (item) {
            if (item.name.indexOf("TileMesh") == 0)
                return true;
            else
                return false;
        });

        if (meshFound != null && meshFound.pickedPoint != null) {
            this._vehicleElevationY = meshFound.pickedPoint.y;
        }


        // position vehicle along path and correct elevation to match closest tile
        if (this._playbackRoutePath &&
           this._wayPointPath &&
           this._wayPointPath.length > this._wayPointCurrentIndex) {


            // move the vehicle along the route path.
            var newPos = getPointAlongLine(this._vehicle.position.x, this._vehicle.position.z, this._wayPointPath[this._wayPointCurrentIndex].targetPosition.x, this._wayPointPath[this._wayPointCurrentIndex].targetPosition.y, this._vehicleSpeed * 0.5);
            this._vehicle.position = new BABYLON.Vector3(newPos.x, this._vehicleElevationY, newPos.y);

            // move the skybox along too.
            this._skybox.position = this._vehicle.position;

            // should we advance waypoint?
            if (distanceBetweenPoints(newPos.x, newPos.y, this._wayPointPath[this._wayPointCurrentIndex].targetPosition.x, this._wayPointPath[this._wayPointCurrentIndex].targetPosition.y) < this._wayPointHitThreshold) {
                this._wayPointCurrentIndex++;
            }

            this._camera.target = (this._vehicle.position);

        }

        if (!occupied) {

            var tile = tileFarthest;

            tile.position.x = checkX;
            tile.position.z = checkY;

            console.log("moved tile " + tile.name + " to " + checkX + ", " + checkY);

            // account for 1/2 size tiles
            var mapPixelX = this._posCenterMap.x + (checkX * (this._tileSize / this._tileSizeInMap)) + (this._gridSize / 2 * this._tileSize);
            var mapPixelY = this._posCenterMap.y - (checkY * (this._tileSize / this._tileSizeInMap)) + (this._gridSize / 2 * this._tileSize);

            var tileXY = pixelXYToTileXY(mapPixelX, mapPixelY);
            var quadKey = tileXYToQuadKey(tileXY.x, tileXY.y, this._levelOfDetail);
            var imageSrc = "mapTile.jpg?quadKey=" + quadKey;   // "Earth__land.jpg"; 
            tile.material.diffuseTexture = new BABYLON.Texture(imageSrc, this._scene);

            this.getElevations(tile.name, tileXY.x, tileXY.y);
        }

        this._locationToCheck = (this._locationToCheck + 1) % (this._locationsToCheck.length);

    }

    BINGWEBGL.Engine.prototype.setupTiles = function () {

        for (var xx = 0; xx < this._gridSize; xx++) {
            for (var yy = 0; yy < this._gridSize; yy++) {

                var tileMaterial = new BABYLON.StandardMaterial("tile_" + xx + "_" + yy, this._scene);
                tileMaterial.diffuseTexture = new BABYLON.Texture("images/play.png", this._scene);

                var meshName = "TileMesh_" + xx + "_" + yy;
                var tile = this.createGroundFromElevationData(meshName, null, this._tileSizeInMap, this._tileSizeInMap, this._tileMeshSubdivisions, 0, 1000, this._scene, true);

                // *ACK* position the mesh
                tile.material = tileMaterial;

                this._tileList.push(tile);
            }
        }
    }


    BINGWEBGL.Engine.prototype.setupTilesForArea = function (latitude, longitude, levelOfDetail) {


        var pixelXY = latLongToPixelXY(latitude, longitude, levelOfDetail, this._minLatitude, this._minLongitude);

        // add a buffer to the tiles so that target is at center
        pixelXY.x = pixelXY.x - ((this._gridSize * this._tileSize) / 2);
        pixelXY.y = pixelXY.y - ((this._gridSize * this._tileSize) / 2);

        // save the top, left position of the starting tile
        var tileStartXY = { x: Math.floor(pixelXY.x / 256) + 0.5, y: Math.floor(pixelXY.y / 256) + 0.5 };
        this._posCenterTile = tileXYToPixelXY(tileStartXY.x, tileStartXY.y);

        var tileXY = pixelXYToTileXY(pixelXY.x, pixelXY.y);
        this._posCenterMap = tileXYToPixelXY(tileXY.x, tileXY.y);

        this._tilesInitialized = true;
    }

    BINGWEBGL.Engine.prototype.latLongToBabylonXY = function (latitude, longitude, levelOfDetail, heightOffMap) {
        var wayPos = latLongToPixelXY(latitude, longitude, levelOfDetail);

        var xPos = wayPos.x - this._posCenterTile.x - ((this._gridSize / 2) * this._tileSize);
        var yPos = wayPos.y - this._posCenterTile.y - ((this._gridSize / 2) * this._tileSize);;

        // account for 1/2 size tiles
        xPos = xPos / (this._tileSize / this._tileSizeInMap);
        yPos = yPos / (this._tileSize / this._tileSizeInMap);

        return new BABYLON.Vector3(xPos, heightOffMap, -yPos);
    }

    BINGWEBGL.Engine.prototype.createGroundFromElevationData = function (name, elevations, width, height, subdivisions, minHeight, maxHeight, scene, updatable) {
        var ground;

        ground = this._scene.getMeshByName(name);
        if (ground == null)
            ground = new BABYLON.Mesh(name, this._scene);

        ground._isReady = false;

        var indices = [];
        var positions = [];
        var normals = [];
        var uvs = [];
        var row, col;

        // Getting height map data
        var heightMapWidth, heightMapHeight;
        if (elevations != null) {
            heightMapWidth = elevations.length / 2
            heightMapHeight = elevations.length / 2;
        }

        // Vertices
        var elevationIndex = 0;
        for (row = 0; row <= subdivisions; row++) {
            for (col = 0; col <= subdivisions; col++) {
                var position = new BABYLON.Vector3((col * width) / subdivisions - (width / 2.0), 0, ((subdivisions - row) * height) / subdivisions - (height / 2.0));

                // Compute height
                if (elevations != null) {
                    var heightMapX = (((position.x + width / 2) / width) * (heightMapWidth - 1)) | 0;
                    var heightMapY = ((1.0 - (position.z + height / 2) / height) * (heightMapHeight - 1)) | 0;

                    position.y = (elevations[elevationIndex] - this._meanElevation);  // Math.random() * 20;
                    elevationIndex++;
                }

                // Add  vertex
                positions.push(position.x, position.y, position.z);
                normals.push(0, 0, 0);
                uvs.push(col / subdivisions, 1.0 - row / subdivisions);
            }
        }

        // Indices
        for (row = 0; row < subdivisions; row++) {
            for (col = 0; col < subdivisions; col++) {
                indices.push(col + 1 + (row + 1) * (subdivisions + 1));
                indices.push(col + 1 + row * (subdivisions + 1));
                indices.push(col + row * (subdivisions + 1));

                indices.push(col + (row + 1) * (subdivisions + 1));
                indices.push(col + 1 + (row + 1) * (subdivisions + 1));
                indices.push(col + row * (subdivisions + 1));
            }
        }

        // Normals
        BABYLON.Mesh.ComputeNormal(positions, normals, indices);

        // Transfer
        ground.setVerticesData(positions, BABYLON.VertexBuffer.PositionKind, updatable);
        ground.setVerticesData(normals, BABYLON.VertexBuffer.NormalKind, updatable);
        ground.setVerticesData(uvs, BABYLON.VertexBuffer.UVKind, updatable);
        ground.setIndices(indices);

        ground._updateBoundingInfo();

        ground._isReady = true;

        return ground;
    };

}
