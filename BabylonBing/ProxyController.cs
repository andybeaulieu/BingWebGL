using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;

namespace BingWebGL
{
    public class ProxyController : ApiController
    {
        const string _bingMapsKey = "*** ENTER YOUR BING MAPS API KEY HERE ***";

        [HttpPost]
        public string GetDirections([FromBody]string value)
        {
            string directions = String.Format("http://dev.virtualearth.net/REST/V1/Routes/Driving?{0}&key={1}&optmz=distance&rpo=Points", value, _bingMapsKey);
            string result = null;

            // Create the web request  
            HttpWebRequest request = WebRequest.Create(directions) as HttpWebRequest;

            // Get response 
            try
            {
                using (HttpWebResponse response = request.GetResponse() as HttpWebResponse)
                {
                    // Get the response stream  
                    StreamReader reader = new StreamReader(response.GetResponseStream());

                    // Console application output  
                    result = reader.ReadToEnd();
                }
            }
            catch (WebException ex)
            {
                if (ex.Response != null) 
                {
                    if (ex.Response.ContentLength != 0)
                    {
                        using (var stream = ex.Response.GetResponseStream())
                        {
                            using (var reader = new StreamReader(stream))
                            {
                                result = reader.ReadToEnd();
                            }
                        }
                    }
                }
            }

            return result;
        }



        [HttpPost]
        public string GetElevations([FromBody]string value)
        {
            //string directions = String.Format("http://dev.virtualearth.net/REST/v1/Elevation/Bounds?bounds={0}&rows=4&cols=4&key={1}", value, _bingMapsKey);
            string directions = String.Format("http://dev.virtualearth.net/REST/v1/Elevation/List?points={0}&key={1}", value, _bingMapsKey);
            string result = null;

            // Create the web request  
            HttpWebRequest request = WebRequest.Create(directions) as HttpWebRequest;

            // Get response  
            try
            {
                using (HttpWebResponse response = request.GetResponse() as HttpWebResponse)
                {
                    // Get the response stream  
                    StreamReader reader = new StreamReader(response.GetResponseStream());

                    // Console application output  
                    result = reader.ReadToEnd();
                }
            }
            catch (Exception ex)
            {
                // something bad happened with bing request
            }

            return result;
        }
    }
}