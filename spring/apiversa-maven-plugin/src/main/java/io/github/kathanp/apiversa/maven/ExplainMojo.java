package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Prints the chain for one route and a local sample. */
@Mojo(name = "explain", requiresProject = true)
public class ExplainMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Parameter(property = "apiversa.version", required = true)
    private String version;

    @Parameter(property = "apiversa.route", required = true)
    private String route;

    @Parameter(property = "apiversa.today")
    private String today;

    @Override
    public void execute() throws MojoFailureException {
        try {
            getLog().info(Explain.explain(dir.toPath(), version, route, today));
        } catch (RuntimeException exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
